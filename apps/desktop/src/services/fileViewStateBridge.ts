import type { FileViewState, FileViewStateCapture, FileViewRestorePending } from "./fileViewState";
import { logDesktopUi } from "./desktopUiLog";

let captureFn: (() => FileViewStateCapture | null) | null = null;
let pendingRestore: FileViewRestorePending | null = null;
let settledClearTimer: ReturnType<typeof setTimeout> | null = null;
/** Optional post-seek suppress window (restore itself seeks to segment start). */
let suppressSelectSeekUntilMs = 0;

/** How long ready+seek+scroll must hold before dropping the pending restore. */
export const FILE_VIEW_RESTORE_SETTLE_MS = 1000;
/**
 * While pending restore owns viewport/seek, competing select→listen-jump must wait.
 * Optional short post-seek window remains available for callers that need it.
 */
export const FILE_VIEW_RESTORE_SELECT_SEEK_SUPPRESS_MS = 2500;

/** Transcription layer registers a live snapshot reader while the editor is mounted. */
export function registerFileViewStateCapture(
  fn: (() => FileViewStateCapture | null) | null,
): void {
  captureFn = fn;
}

export function captureFileViewStateNow(): FileViewStateCapture | null {
  if (!captureFn) {
    logDesktopUi("WARN", "[fvsr] captureNow: no captureFn registered");
    return null;
  }
  try {
    const snap = captureFn();
    if (!snap) logDesktopUi("WARN", "[fvsr] captureNow: captureFn returned null");
    return snap ?? null;
  } catch (e) {
    logDesktopUi("ERROR", `[fvsr] captureNow threw: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export function armFileViewRestore(fileId: string, state: FileViewState): void {
  cancelScheduledFileViewRestoreClear();
  suppressSelectSeekUntilMs = 0;
  pendingRestore = { fileId, state };
}

/** Optional: extend select-seek suppress after pending restore clears. */
export function markFileViewRestorePlayheadApplied(
  suppressMs = FILE_VIEW_RESTORE_SELECT_SEEK_SUPPRESS_MS,
): void {
  suppressSelectSeekUntilMs = performance.now() + Math.max(0, suppressMs);
}

/**
 * True while a file-view restore is in flight (or during an optional post-seek window).
 * Competing select→seek/reveal must not fight restore's segment-centric apply.
 */
export function shouldSuppressSegmentSelectSeekForFileViewRestore(): boolean {
  if (pendingRestore) return true;
  return performance.now() < suppressSelectSeekUntilMs;
}

export function cancelScheduledFileViewRestoreClear(): void {
  if (settledClearTimer != null) {
    clearTimeout(settledClearTimer);
    settledClearTimer = null;
  }
}

export function clearFileViewRestore(): void {
  cancelScheduledFileViewRestoreClear();
  pendingRestore = null;
  // Keep suppressSelectSeekUntilMs — post-seek window must outlive pending clear.
}

/**
 * Drop pending restore only after scroll+seek stuck through WaveSurfer remount flicker.
 * Call after each successful seek/scroll apply while pending still matches `fileId`.
 */
export function scheduleClearFileViewRestoreWhenSettled(
  fileId: string,
  settleMs = FILE_VIEW_RESTORE_SETTLE_MS,
): void {
  const pending = peekFileViewRestoreForFile(fileId);
  if (!pending?.scrollApplied || !pending.seekApplied) return;
  cancelScheduledFileViewRestoreClear();
  settledClearTimer = setTimeout(() => {
    settledClearTimer = null;
    const p = peekFileViewRestoreForFile(fileId);
    if (p?.scrollApplied && p.seekApplied) clearFileViewRestore();
  }, settleMs);
}

export function peekFileViewRestore(): FileViewRestorePending | null {
  return pendingRestore;
}

export function peekFileViewRestoreForFile(fileId: string | null): FileViewRestorePending | null {
  if (!fileId || !pendingRestore || pendingRestore.fileId !== fileId) return null;
  return pendingRestore;
}
