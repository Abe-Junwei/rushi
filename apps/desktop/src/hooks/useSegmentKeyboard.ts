import { useCallback, useRef } from "react";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "./useProjectWaveform";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { isFindReplacePanelOpen } from "../pages/findReplaceTypes";
import { readStoredTabAdvanceLoopsSegment } from "../utils/waveformPrefs";
import { focusTranscriptSegmentTextarea } from "../utils/focusTranscriptSegmentTextarea";

type WfApi = ReturnType<typeof useProjectWaveform>;

/** 正文 textarea 专用键：↑↓ 切语段（全局结构键见 editorShortcutRegistry）。 */
export function useSegmentKeyboard(args: {
  ctxRef: React.MutableRefObject<TranscriptionLayerInput>;
  wfApiRef: React.MutableRefObject<WfApi>;
  selectSegmentAtRef: React.MutableRefObject<
    (idx: number, source?: SegmentSelectSource, opts?: { shiftKey?: boolean }) => void
  >;
  tierScrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const focusSegmentTextarea = useCallback(
    (segmentIdx: number) => {
      focusTranscriptSegmentTextarea(argsRef.current.tierScrollRef.current, segmentIdx);
    },
    [],
  );

  const onSegmentTextareaKeyDown = useCallback(
    (segmentIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && isFindReplacePanelOpen()) return;

      const a = argsRef.current;
      const c = a.ctxRef.current;
      const w = a.wfApiRef.current;

      if (!c.busy && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const el = e.currentTarget;
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        const collapsed = start === end;
        if (e.key === "Delete" && collapsed && end === el.value.length && segmentIdx < c.segments.length - 1) {
          e.preventDefault();
          c.mergeWithNextAt(segmentIdx);
          focusSegmentTextarea(segmentIdx);
          return;
        }
      }

      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      e.preventDefault();
      const advanceLoop = readStoredTabAdvanceLoopsSegment();
      const playOpts = { loop: advanceLoop } as const;
      if (e.key === "ArrowUp") {
        if (segmentIdx <= 0) return;
        const pi = segmentIdx - 1;
        if (!c.segments[pi]) return;
        if (advanceLoop) w.preserveLoopForNextSegmentSelect();
        a.selectSegmentAtRef.current(pi, "listAdvance");
        void w.playSegmentAtIndex(pi, playOpts);
        focusSegmentTextarea(pi);
      } else {
        if (segmentIdx >= c.segments.length - 1) return;
        const ni = segmentIdx + 1;
        if (!c.segments[ni]) return;
        if (advanceLoop) w.preserveLoopForNextSegmentSelect();
        a.selectSegmentAtRef.current(ni, "listAdvance");
        void w.playSegmentAtIndex(ni, playOpts);
        focusSegmentTextarea(ni);
      }
    },
    [focusSegmentTextarea],
  );

  return { onSegmentTextareaKeyDown, focusSegmentTextarea };
}
