import { useEffect, useRef, useState, type RefObject } from "react";
import {
  resolveRestoreSeekSec,
  type FileViewRestorePending,
} from "../services/fileViewState";
import {
  peekFileViewRestoreForFile,
  scheduleClearFileViewRestoreWhenSettled,
  cancelScheduledFileViewRestoreClear,
} from "../services/fileViewStateBridge";
import { writeStoredWaveformPxPerSec } from "../utils/waveformPrefs";
import { findSegmentIndexByUid } from "../pages/segmentListHelpers";
import {
  getTranscriptEditorView,
} from "../components/editor/core/transcriptEditorViewHandle";
import { revealSegmentInScrollDOM } from "../components/editor/core/revealSegment";
import { selectSegmentCommand } from "../components/editor/core/selectionCommands";
import { primarySegmentIdx } from "../components/editor/core/selectionField";
import { getTranscriptProjectionSnapshot } from "../components/editor/core/transcriptProjection";
import { logDesktopUi } from "../services/desktopUiLog";
import type { SegmentDto } from "../tauri/projectTypes";

export type { FileViewRestorePending };

const FILE_VIEW_SELECTION_RETRY_MS = 50;
const FILE_VIEW_SELECTION_MAX_RETRIES = 40;
const FILE_VIEW_VIEWPORT_RETRY_MS = 50;
const FILE_VIEW_VIEWPORT_MAX_RETRIES = 40;

/**
 * Apply pending per-file view restore: zoom → select segment → text/waveform
 * into viewport → seek to segment start (exact prior playhead/scroll optional).
 * Keeps pending alive across WaveSurfer remount flicker so seek can re-apply
 * when `isReady`/`audioReady` return; clears only after a short settle window.
 */
export function useFileViewStateRestoreEffect(args: {
  fileId: string | null;
  mediaUrl: string | null;
  mediaDurationSec: number;
  /** Current layout zoom — viewport reveal waits until this matches the restored target. */
  layoutPxPerSec: number;
  isReady: boolean;
  /** Native transport must be loaded before seek (desktop Tauri). */
  audioReady: boolean;
  segments: readonly SegmentDto[];
  setPxPerSec: (px: number) => void;
  seek: (timeSec: number) => void;
  /** Host selection (SC1 / selectedIdxRef) — CM6 may not be mounted at openFile time. */
  selectSegmentAt: (idx: number) => void;
  suppressPlaybackFollowForSelectionSeek: () => void;
  syncDisplayPlayheadAfterSeek?: (timeSec: number) => void;
  /** Center/fit the selected waveform segment after zoom is applied. */
  revealSegmentInViewport: (seg: { start_sec: number; end_sec: number }) => void;
  tierScrollRef: RefObject<HTMLDivElement | null>;
}) {
  const {
    fileId,
    mediaUrl,
    mediaDurationSec,
    layoutPxPerSec,
    isReady,
    audioReady,
    segments,
    setPxPerSec,
    seek,
    selectSegmentAt,
    suppressPlaybackFollowForSelectionSeek,
    syncDisplayPlayheadAfterSeek,
    revealSegmentInViewport,
    tierScrollRef,
  } = args;

  const setPxPerSecRef = useRef(setPxPerSec);
  setPxPerSecRef.current = setPxPerSec;
  const seekRef = useRef(seek);
  seekRef.current = seek;
  const selectSegmentAtRef = useRef(selectSegmentAt);
  selectSegmentAtRef.current = selectSegmentAt;
  const suppressRef = useRef(suppressPlaybackFollowForSelectionSeek);
  suppressRef.current = suppressPlaybackFollowForSelectionSeek;
  const syncDisplayRef = useRef(syncDisplayPlayheadAfterSeek);
  syncDisplayRef.current = syncDisplayPlayheadAfterSeek;
  const revealSegmentRef = useRef(revealSegmentInViewport);
  revealSegmentRef.current = revealSegmentInViewport;
  const [selectionRetryNonce, setSelectionRetryNonce] = useState(0);
  const selectionRetryTimerRef = useRef<number | null>(null);
  const [viewportRetryNonce, setViewportRetryNonce] = useState(0);
  const viewportRetryTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (selectionRetryTimerRef.current != null) {
        window.clearTimeout(selectionRetryTimerRef.current);
        selectionRetryTimerRef.current = null;
      }
      if (viewportRetryTimerRef.current != null) {
        window.clearTimeout(viewportRetryTimerRef.current);
        viewportRetryTimerRef.current = null;
      }
    },
    [fileId],
  );

  useEffect(() => {
    const pending = peekFileViewRestoreForFile(fileId);
    if (!fileId || !mediaUrl || !pending) return;
    if (pending.zoomApplied) return;
    pending.zoomApplied = true;
    setPxPerSecRef.current(pending.state.layoutPxPerSec);
    writeStoredWaveformPxPerSec(pending.state.layoutPxPerSec);
  }, [fileId, mediaUrl]);

  // CM6 remounts on fileId (seeds idx 0 by default) and may wipe a first apply.
  // Keep re-asserting selection + text reveal while pending restore is alive.
  useEffect(() => {
    const pending = peekFileViewRestoreForFile(fileId);
    if (!fileId || !pending) return;
    const idx = findSegmentIndexByUid(segments, pending.state.selectedSegmentUid);
    if (idx < 0) {
      pending.selectionApplied = true;
      return;
    }

    const view = getTranscriptEditorView();
    if (!view || idx >= view.state.doc.lines) {
      pending.selectionRetryCount = (pending.selectionRetryCount ?? 0) + 1;
      if (pending.selectionRetryCount > FILE_VIEW_SELECTION_MAX_RETRIES) {
        pending.selectionApplied = true;
        return;
      }
      if (selectionRetryTimerRef.current == null) {
        selectionRetryTimerRef.current = window.setTimeout(() => {
          selectionRetryTimerRef.current = null;
          setSelectionRetryNonce((n) => n + 1);
        }, FILE_VIEW_SELECTION_RETRY_MS);
      }
      return;
    }

    // Re-assert selection whenever wiped; always re-reveal text while pending.
    const primary = primarySegmentIdx(view.state);
    const projectionPrimary = getTranscriptProjectionSnapshot().primaryIdx;
    if (primary !== idx || projectionPrimary !== idx) {
      selectSegmentCommand(view, idx, { scrollIntoView: false });
      selectSegmentAtRef.current(idx);
    }
    revealSegmentInScrollDOM(view, idx, { y: "center" });

    const projectionOk = getTranscriptProjectionSnapshot().primaryIdx === idx;
    if (projectionOk) {
      pending.selectionApplied = true;
      logDesktopUi("INFO", `[fvsr] selection apply file=${fileId} idx=${idx}`);
    } else {
      pending.selectionRetryCount = (pending.selectionRetryCount ?? 0) + 1;
      if (pending.selectionRetryCount > FILE_VIEW_SELECTION_MAX_RETRIES) {
        pending.selectionApplied = true;
      }
    }

    // Re-check until pending settles — remount / structure sync can wipe after a good apply.
    if (selectionRetryTimerRef.current == null && peekFileViewRestoreForFile(fileId)) {
      selectionRetryTimerRef.current = window.setTimeout(() => {
        selectionRetryTimerRef.current = null;
        if (!peekFileViewRestoreForFile(fileId)) return;
        setSelectionRetryNonce((n) => n + 1);
      }, FILE_VIEW_SELECTION_RETRY_MS);
    }
  }, [fileId, mediaUrl, segments, isReady, selectionRetryNonce]);

  // Reveal the selected waveform segment once zoom layout is ready.
  // Exact prior scrollLeft is optional — segment visibility is the product goal.
  useEffect(() => {
    const pending = peekFileViewRestoreForFile(fileId);
    if (!fileId || !mediaUrl || !pending) return;
    if (!pending.zoomApplied || pending.scrollApplied) return;
    if (!isReady) return;
    const zoomMatches = Math.abs(layoutPxPerSec - pending.state.layoutPxPerSec) <= 0.05;
    if (!pending.zoomLayoutSeen) {
      pending.zoomLayoutSeen = true;
      if (!zoomMatches) return;
    }
    if (!zoomMatches) return;

    const idx = findSegmentIndexByUid(segments, pending.state.selectedSegmentUid);
    if (idx >= 0) {
      const seg = segments[idx];
      const tier = tierScrollRef.current;
      if (!tier || tier.clientWidth <= 0) {
        pending.scrollRetryCount = (pending.scrollRetryCount ?? 0) + 1;
        if (
          pending.scrollRetryCount <= FILE_VIEW_VIEWPORT_MAX_RETRIES &&
          viewportRetryTimerRef.current == null
        ) {
          viewportRetryTimerRef.current = window.setTimeout(() => {
            viewportRetryTimerRef.current = null;
            setViewportRetryNonce((n) => n + 1);
          }, FILE_VIEW_VIEWPORT_RETRY_MS);
        }
        if (pending.scrollRetryCount <= FILE_VIEW_VIEWPORT_MAX_RETRIES) return;
      } else {
        suppressRef.current();
        revealSegmentRef.current({ start_sec: seg.start_sec, end_sec: seg.end_sec });
        logDesktopUi(
          "INFO",
          `[fvsr] viewport reveal file=${fileId} idx=${idx} start=${seg.start_sec.toFixed(2)}`,
        );
      }
    }

    pending.scrollApplied = true;
    scheduleClearFileViewRestoreWhenSettled(fileId);
  }, [
    fileId,
    mediaUrl,
    layoutPxPerSec,
    isReady,
    segments,
    tierScrollRef,
    viewportRetryNonce,
  ]);

  useEffect(() => {
    const pending = peekFileViewRestoreForFile(fileId);
    if (!fileId || !mediaUrl || !pending) return;
    if (!pending.zoomApplied) return;
    // Remount flicker: cancel settle clear and re-seek when ready again.
    if (!isReady || !audioReady) {
      logDesktopUi(
        "INFO",
        `[fvsr] seek wait-ready file=${fileId} isReady=${isReady} audioReady=${audioReady} dur=${mediaDurationSec.toFixed(2)}`,
      );
      cancelScheduledFileViewRestoreClear();
      return;
    }
    const idx = findSegmentIndexByUid(segments, pending.state.selectedSegmentUid);
    const segmentStartSec = idx >= 0 ? segments[idx].start_sec : null;
    if (segmentStartSec == null && !(mediaDurationSec >= 0.5) && pending.state.playheadSec > 0.5) {
      logDesktopUi(
        "INFO",
        `[fvsr] seek wait-duration file=${fileId} dur=${mediaDurationSec.toFixed(2)} want=${pending.state.playheadSec.toFixed(2)}`,
      );
      return;
    }
    const target = resolveRestoreSeekSec({
      playheadSec: pending.state.playheadSec,
      segmentStartSec,
      durationSec: mediaDurationSec,
    });
    suppressRef.current();
    seekRef.current(target);
    syncDisplayRef.current?.(target);
    pending.seekApplied = true;
    logDesktopUi(
      "INFO",
      `[fvsr] seek apply file=${fileId} target=${target.toFixed(2)} segStart=${segmentStartSec?.toFixed(2) ?? "null"} fromPlayhead=${pending.state.playheadSec.toFixed(2)} dur=${mediaDurationSec.toFixed(2)}`,
    );
    scheduleClearFileViewRestoreWhenSettled(fileId);
  }, [fileId, mediaUrl, isReady, audioReady, mediaDurationSec, segments]);
}

/** True while a restore is pending for this file — skip media scroll/zoom resets. */
export function shouldSkipMediaResetForFileViewRestore(
  pending: FileViewRestorePending | null,
  fileId: string | null,
): boolean {
  return Boolean(pending && fileId && pending.fileId === fileId);
}
