import { useCallback, useEffect, useRef } from "react";
import type { P1TranscriptionLayerInput } from "../pages/useP1TranscriptionLayer";
import type { useProjectWaveform } from "./useProjectWaveform";

type WfApi = ReturnType<typeof useProjectWaveform>;

export function useP1SegmentKeyboard(args: {
  ctxRef: React.MutableRefObject<P1TranscriptionLayerInput>;
  wfApiRef: React.MutableRefObject<WfApi>;
  setSelectedIdxUi: (idx: number) => void;
}) {
  const setSelectedIdxUiRef = useRef(args.setSelectedIdxUi);
  setSelectedIdxUiRef.current = args.setSelectedIdxUi;

  const onWaveformMainKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const c = args.ctxRef.current;
      const w = args.wfApiRef.current;
      if (c.busy) return;
      const t = e.target as HTMLElement;
      if (t.closest("textarea, input, [contenteditable=true]")) return;

      const mod = e.metaKey || e.ctrlKey;
      const setSel = setSelectedIdxUiRef.current;

      const seekSeg = (idx: number) => {
        const s = c.segments[idx];
        if (!s) return;
        w.seek(s.start_sec);
        setSel(idx);
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
        c.mergeWithPrev();
        return;
      }
      if (mod && e.key.toLowerCase() === "m" && !e.shiftKey) {
        e.preventDefault();
        c.mergeWithNext();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        c.splitAtPlayhead(w.getPlayheadTime());
        return;
      }
      if (e.key === "ArrowLeft" && !mod) {
        e.preventDefault();
        if (c.selectedIdx > 0) seekSeg(c.selectedIdx - 1);
        return;
      }
      if (e.key === "ArrowRight" && !mod) {
        e.preventDefault();
        if (c.selectedIdx < c.segments.length - 1) seekSeg(c.selectedIdx + 1);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (!e.shiftKey) {
          if (c.selectedIdx < c.segments.length - 1) {
            const ni = c.selectedIdx + 1;
            seekSeg(ni);
            void w.playSegmentAtIndex(ni);
          }
        } else if (c.selectedIdx > 0) {
          const pi = c.selectedIdx - 1;
          seekSeg(pi);
          void w.playSegmentAtIndex(pi);
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
        if (j >= 0) seekSeg(j);
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
        if (j >= 0) seekSeg(j);
      }
    },
    [args.ctxRef, args.wfApiRef],
  );

  const onSegmentTextareaKeyDown = useCallback(
    (segmentIdx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      const c = args.ctxRef.current;
      const w = args.wfApiRef.current;
      if (e.key !== "Tab") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      const setSel = setSelectedIdxUiRef.current;
      if (e.shiftKey) {
        if (segmentIdx <= 0) return;
        const pi = segmentIdx - 1;
        const s = c.segments[pi];
        if (!s) return;
        w.seek(s.start_sec);
        setSel(pi);
        void w.playSegmentAtIndex(pi);
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(`[data-p1-seg-row="${pi}"] input.p1-seg-text`)?.focus();
        });
      } else {
        if (segmentIdx >= c.segments.length - 1) return;
        const ni = segmentIdx + 1;
        const s = c.segments[ni];
        if (!s) return;
        w.seek(s.start_sec);
        setSel(ni);
        void w.playSegmentAtIndex(ni);
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(`[data-p1-seg-row="${ni}"] input.p1-seg-text`)?.focus();
        });
      }
    },
    [args.ctxRef, args.wfApiRef],
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
