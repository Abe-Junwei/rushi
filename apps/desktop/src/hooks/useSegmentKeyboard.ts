import { useCallback, useEffect, useRef } from "react";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "./useProjectWaveform";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { readStoredTabAdvanceLoopsSegment } from "../utils/waveformPrefs";

type WfApi = ReturnType<typeof useProjectWaveform>;

export function useSegmentKeyboard(args: {
  ctxRef: React.MutableRefObject<TranscriptionLayerInput>;
  wfApiRef: React.MutableRefObject<WfApi>;
  selectSegmentAtRef: React.MutableRefObject<(idx: number, source?: SegmentSelectSource) => void>;
  tierScrollRef: React.RefObject<HTMLDivElement | null>;
  showEditorHintRef: React.MutableRefObject<(msg: string) => void>;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const onWaveformMainKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const a = argsRef.current;
      const c = a.ctxRef.current;
      const w = a.wfApiRef.current;
      if (c.busy) return;
      const t = e.target as HTMLElement;
      if (t.closest("textarea, input, [contenteditable=true]")) return;

      const mod = e.metaKey || e.ctrlKey;
      const selectSeg = (idx: number) => {
        a.selectSegmentAtRef.current(idx, "waveform");
      };

      if (e.key === "Escape") {
        e.preventDefault();
        (e.target as HTMLElement).blur();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        void w.togglePlay();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (c.segments.length > 0) c.deleteSegmentAt(c.selectedIdx);
        return;
      }
      if (mod && e.key.toLowerCase() === "m" && e.shiftKey) {
        e.preventDefault();
        if (c.selectedIdx > 0) c.mergeWithPrev();
        return;
      }
      if (mod && e.key.toLowerCase() === "m" && !e.shiftKey) {
        e.preventDefault();
        if (c.selectedIdx >= 0 && c.selectedIdx < c.segments.length - 1) c.mergeWithNext();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (c.selectedIdx >= 0 && c.selectedIdx < c.segments.length) {
          c.splitAtPlayhead(w.getPlayheadTime());
        }
        return;
      }
      if (e.key === "ArrowLeft" && !mod) {
        e.preventDefault();
        if (c.selectedIdx > 0) selectSeg(c.selectedIdx - 1);
        return;
      }
      if (e.key === "ArrowRight" && !mod) {
        e.preventDefault();
        if (c.selectedIdx < c.segments.length - 1) selectSeg(c.selectedIdx + 1);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const tabLoop = readStoredTabAdvanceLoopsSegment();
        const tabPlayOpts = {
          loop: tabLoop,
          useGlobalPlaybackRate: true,
        } as const;
        if (!e.shiftKey) {
          if (c.selectedIdx < c.segments.length - 1) {
            const ni = c.selectedIdx + 1;
            if (tabLoop) w.preserveLoopForNextSegmentSelect();
            selectSeg(ni);
            void w.playSegmentAtIndex(ni, tabPlayOpts);
          }
        } else if (c.selectedIdx > 0) {
          const pi = c.selectedIdx - 1;
          if (tabLoop) w.preserveLoopForNextSegmentSelect();
          selectSeg(pi);
          void w.playSegmentAtIndex(pi, tabPlayOpts);
        }
        return;
      }
      if (e.key === "," && !mod) {
        e.preventDefault();
        w.seekByDelta(-1 / 30);
        return;
      }
      if (e.key === "." && !mod) {
        e.preventDefault();
        w.seekByDelta(1 / 30);
        return;
      }
      if (e.key === "[" && !mod) {
        e.preventDefault();
        const from = c.selectedIdx;
        let j = -1;
        for (let k = from - 1; k >= 0; k--) {
          if (c.segments[k]?.low_confidence) {
            j = k;
            break;
          }
        }
        if (j < 0) {
          for (let k = c.segments.length - 1; k >= 0; k--) {
            if (c.segments[k]?.low_confidence) {
              j = k;
              break;
            }
          }
        }
        if (j >= 0) {
          selectSeg(j);
        } else {
          a.showEditorHintRef.current("没有低置信度语段。");
        }
        return;
      }
      if (e.key === "]" && !mod) {
        e.preventDefault();
        const from = c.selectedIdx;
        let j = -1;
        for (let k = from + 1; k < c.segments.length; k++) {
          if (c.segments[k]?.low_confidence) {
            j = k;
            break;
          }
        }
        if (j < 0) {
          for (let k = 0; k < c.segments.length; k++) {
            if (c.segments[k]?.low_confidence) {
              j = k;
              break;
            }
          }
        }
        if (j >= 0) {
          selectSeg(j);
        } else {
          a.showEditorHintRef.current("没有低置信度语段。");
        }
        return;
      }
    },
    [],
  );

  const onSegmentTextareaKeyDown = useCallback(
    (segmentIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const a = argsRef.current;
      const c = a.ctxRef.current;
      const w = a.wfApiRef.current;
      if (e.key !== "Tab") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      const tabLoop = readStoredTabAdvanceLoopsSegment();
      const tabPlayOpts = { loop: tabLoop, useGlobalPlaybackRate: true } as const;
      if (e.shiftKey) {
        if (segmentIdx <= 0) return;
        const pi = segmentIdx - 1;
        if (!c.segments[pi]) return;
        if (tabLoop) w.preserveLoopForNextSegmentSelect();
        a.selectSegmentAtRef.current(pi, "list");
        void w.playSegmentAtIndex(pi, tabPlayOpts);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const root = a.tierScrollRef.current;
            const selector = `[data-seg-row="${pi}"] textarea.seg-text, [data-seg-row="${pi}"] input.seg-text`;
            const target = root?.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>(selector);
            target?.focus();
          });
        });
      } else {
        if (segmentIdx >= c.segments.length - 1) return;
        const ni = segmentIdx + 1;
        if (!c.segments[ni]) return;
        if (tabLoop) w.preserveLoopForNextSegmentSelect();
        a.selectSegmentAtRef.current(ni, "list");
        void w.playSegmentAtIndex(ni, tabPlayOpts);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const root = a.tierScrollRef.current;
            const selector = `[data-seg-row="${ni}"] textarea.seg-text, [data-seg-row="${ni}"] input.seg-text`;
            const target = root?.querySelector<HTMLElement>(selector) ?? document.querySelector<HTMLElement>(selector);
            target?.focus();
          });
        });
      }
    },
    [],
  );

  useEffect(() => {
    const onWinKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("textarea, input, [contenteditable=true]")) return;
      e.preventDefault();
      const c = args.ctxRef.current;
      if (e.shiftKey) c.redo();
      else c.undo();
    };
    window.addEventListener("keydown", onWinKey, true);
    return () => window.removeEventListener("keydown", onWinKey, true);
  }, [args.ctxRef]);

  return { onWaveformMainKeyDown, onSegmentTextareaKeyDown };
}
