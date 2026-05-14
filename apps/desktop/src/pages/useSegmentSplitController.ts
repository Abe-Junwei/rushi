import { useCallback } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { buildSplitPair, reindexSegments } from "./segmentListHelpers";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export interface SegmentSplitApi {
  splitAtSelection: (selectedIdx: number) => void;
  splitAtPlayhead: (timeSec: number) => void;
}

export interface SegmentSplitDeps {
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setError: (msg: string) => void;
  pushUndo: () => void;
  flushSegmentTextDraftsFromDom: () => void;
}

export function useSegmentSplitController(deps: SegmentSplitDeps): SegmentSplitApi {
  const { segmentsRef, setSegments, setSelectedIdx, setError, pushUndo, flushSegmentTextDraftsFromDom } = deps;

  const splitAtSelection = useCallback((selectedIdx: number) => {
    flushSegmentTextDraftsFromDom();
    const segs = segmentsRef.current;
    if (segs.length === 0) return;
    const i = Math.min(selectedIdx, segs.length - 1);
    const s = segs[i];
    if (!s) return;
    const mid = (s.start_sec + s.end_sec) / 2;
    const pair = buildSplitPair(s, mid);
    if (!pair) {
      setError("语段太短，无法拆分。");
      return;
    }
    setError("");
    pushUndo();
    setSegments((prev) => {
      const out = [...prev];
      out.splice(i, 1, pair.left, pair.right);
      return reindexSegments(out);
    });
    setSelectedIdx(i + 1);
  }, [flushSegmentTextDraftsFromDom, segmentsRef, setSegments, setSelectedIdx, setError, pushUndo]);

  const splitAtPlayhead = useCallback(
    (timeSec: number) => {
      flushSegmentTextDraftsFromDom();
      const t = roundSec3(timeSec);
      const segs = segmentsRef.current;
      const i = segs.findIndex((s) => t > s.start_sec + 0.02 && t < s.end_sec - 0.02);
      if (i < 0) {
        setError("指针时间不在任一语段内，无法拆分。");
        return;
      }
      const s = segs[i];
      if (!s) return;
      const pair = buildSplitPair(s, t);
      if (!pair) {
        setError("语段太短，无法在该时间拆分。");
        return;
      }
      setError("");
      pushUndo();
      setSegments((prev) => {
        const out = [...prev];
        out.splice(i, 1, pair.left, pair.right);
        return reindexSegments(out);
      });
      setSelectedIdx(i + 1);
    },
    [flushSegmentTextDraftsFromDom, segmentsRef, setSegments, setSelectedIdx, setError, pushUndo],
  );

  return { splitAtSelection, splitAtPlayhead };
}
