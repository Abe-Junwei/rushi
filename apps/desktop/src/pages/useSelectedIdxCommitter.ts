import { startTransition, useCallback } from "react";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";

/**
 * SC1 commit gate: visual chrome (SC2) is already imperative; React selectedIdx is
 * low-priority so list/editor reconcile does not block highlight / seek / reveal.
 * Aligns with desktop-waveform-engine.md (SC2 → SC1 startTransition).
 */
export function useSelectedIdxCommitter(
  setSelectedIdxUi: (idx: number, opts?: SegmentSelectAtOptions) => void,
) {
  return useCallback(
    (idx: number, _source: SegmentSelectSource, opts?: SegmentSelectAtOptions) => {
      startTransition(() => {
        setSelectedIdxUi(idx, opts);
      });
    },
    [setSelectedIdxUi],
  );
}
