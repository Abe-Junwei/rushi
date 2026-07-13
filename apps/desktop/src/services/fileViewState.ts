/**
 * Per-file editor view state (playhead, selection, waveform scroll/zoom).
 * Research: docs/execution/specs/per-file-view-state-restore-research.md
 */

import { clampPxPerSec } from "../utils/pxPerSec";
import { logDesktopUi } from "./desktopUiLog";

export const FILE_VIEW_STATE_KEY_PREFIX = "rushi:file-view-state:v1:";

export type FileViewState = {
  playheadSec: number;
  /** Stable segment id; null when none / missing. */
  selectedSegmentUid: string | null;
  tierScrollLeftPx: number;
  layoutPxPerSec: number;
  updatedAtMs: number;
};

/** In-flight restore while media / timeline catches up. */
export type FileViewRestorePending = {
  fileId: string;
  state: FileViewState;
  zoomApplied?: boolean;
  /** True after the scroll effect has observed post-zoom layout at least once. */
  zoomLayoutSeen?: boolean;
  scrollApplied?: boolean;
  /** Retry count while the tier scroll DOM is not yet laid out wide enough to hold the target. */
  scrollRetryCount?: number;
  selectionApplied?: boolean;
  selectionRetryCount?: number;
  seekApplied?: boolean;
};

/** Live capture payload before `updatedAtMs` is stamped. */
export type FileViewStateCapture = Omit<FileViewState, "updatedAtMs">;

export const FILE_VIEW_RESUME_PREROLL_SEC = 1;
/** If remaining media after playhead is below this, resume from start. */
export const FILE_VIEW_NEAR_END_RESTART_SEC = 2;

export function fileViewStateStorageKey(fileId: string): string {
  return `${FILE_VIEW_STATE_KEY_PREFIX}${fileId}`;
}

function isFiniteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export function parseFileViewState(raw: unknown): FileViewState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isFiniteNonNeg(o.playheadSec)) return null;
  if (!isFiniteNonNeg(o.tierScrollLeftPx)) return null;
  if (typeof o.layoutPxPerSec !== "number" || !Number.isFinite(o.layoutPxPerSec) || o.layoutPxPerSec <= 0) {
    return null;
  }
  if (typeof o.updatedAtMs !== "number" || !Number.isFinite(o.updatedAtMs)) return null;
  const uid = o.selectedSegmentUid;
  if (!(uid === null || (typeof uid === "string" && uid.length > 0))) return null;
  return {
    playheadSec: o.playheadSec,
    selectedSegmentUid: uid,
    tierScrollLeftPx: o.tierScrollLeftPx,
    layoutPxPerSec: clampPxPerSec(o.layoutPxPerSec),
    updatedAtMs: o.updatedAtMs,
  };
}

export function readFileViewState(fileId: string): FileViewState | null {
  if (!fileId) return null;
  try {
    const raw = window.localStorage.getItem(fileViewStateStorageKey(fileId));
    if (!raw) {
      logDesktopUi("INFO", `[fvsr] read miss file=${fileId} (no saved state)`);
      return null;
    }
    const parsed = parseFileViewState(JSON.parse(raw) as unknown);
    logDesktopUi(
      "INFO",
      parsed
        ? `[fvsr] read hit file=${fileId} playhead=${parsed.playheadSec.toFixed(2)} scroll=${parsed.tierScrollLeftPx} px/s=${parsed.layoutPxPerSec} uid=${parsed.selectedSegmentUid ?? "null"}`
        : `[fvsr] read parse-fail file=${fileId} raw=${raw.slice(0, 120)}`,
    );
    return parsed;
  } catch {
    return null;
  }
}

export function writeFileViewState(fileId: string, state: FileViewStateCapture): void {
  if (!fileId) return;
  const next: FileViewState = {
    playheadSec: Math.max(0, state.playheadSec),
    selectedSegmentUid: state.selectedSegmentUid,
    tierScrollLeftPx: Math.max(0, state.tierScrollLeftPx),
    layoutPxPerSec: clampPxPerSec(state.layoutPxPerSec),
    updatedAtMs: Date.now(),
  };
  try {
    window.localStorage.setItem(fileViewStateStorageKey(fileId), JSON.stringify(next));
    logDesktopUi(
      "INFO",
      `[fvsr] write file=${fileId} playhead=${next.playheadSec.toFixed(2)} scroll=${next.tierScrollLeftPx} px/s=${next.layoutPxPerSec} uid=${next.selectedSegmentUid ?? "null"}`,
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearFileViewState(fileId: string): void {
  if (!fileId) return;
  try {
    window.localStorage.removeItem(fileViewStateStorageKey(fileId));
  } catch {
    /* ignore */
  }
}

/**
 * Resolve seek target when restoring a saved playhead.
 * Near-end → 0; otherwise apply preroll and clamp into [0, duration].
 */
export function resolveResumePlayheadSec(
  playheadSec: number,
  durationSec: number,
  prerollSec = FILE_VIEW_RESUME_PREROLL_SEC,
  nearEndSec = FILE_VIEW_NEAR_END_RESTART_SEC,
): number {
  const t = Math.max(0, playheadSec);
  if (!(durationSec > 0.5)) return Math.max(0, t - prerollSec);
  if (t >= durationSec - nearEndSec) return 0;
  return Math.max(0, Math.min(durationSec, t - prerollSec));
}

/**
 * Prefer the selected segment start for restore seek.
 * Exact prior playhead is optional; fall back to preroll resume when no segment.
 */
export function resolveRestoreSeekSec(args: {
  playheadSec: number;
  segmentStartSec: number | null;
  durationSec: number;
  nearEndSec?: number;
}): number {
  const nearEndSec = args.nearEndSec ?? FILE_VIEW_NEAR_END_RESTART_SEC;
  if (args.segmentStartSec != null && Number.isFinite(args.segmentStartSec)) {
    const t = Math.max(0, args.segmentStartSec);
    if (args.durationSec > 0.5 && t >= args.durationSec - nearEndSec) return 0;
    return args.durationSec > 0.5 ? Math.min(t, args.durationSec) : t;
  }
  return resolveResumePlayheadSec(args.playheadSec, args.durationSec);
}
