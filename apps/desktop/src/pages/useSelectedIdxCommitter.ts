import { startTransition, useCallback } from "react";
import { selectionProfileMarkListCommit } from "../services/ui/selectionLatencyProfile";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";

/**
 * SC1 commit gate: visual chrome (SC2) is already imperative; React selectedIdx is
 * low-priority so list/editor reconcile does not block highlight / seek / reveal.
 * Aligns with desktop-waveform-engine.md (SC2 → SC1 startTransition).
 *
 * Records `listCommit` inside the transition (same timing as LKB keyup) without
 * flushing — caller flushes after the rest of the sync path so spans stay intact.
 */
export function useSelectedIdxCommitter(
  setSelectedIdxUi: (idx: number, opts?: SegmentSelectAtOptions) => void,
) {
  return useCallback(
    (idx: number, _source: SegmentSelectSource, opts?: SegmentSelectAtOptions) => {
      startTransition(() => {
        setSelectedIdxUi(idx, opts);
        selectionProfileMarkListCommit({ flush: false });
      });
    },
    [setSelectedIdxUi],
  );
}
