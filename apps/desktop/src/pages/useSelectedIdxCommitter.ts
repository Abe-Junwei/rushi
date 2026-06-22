import { startTransition, useCallback } from "react";
import { isListSegmentSelectSource } from "../utils/segmentListSelectSource";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";

export function useSelectedIdxCommitter(
  setSelectedIdxUi: (idx: number, opts?: SegmentSelectAtOptions) => void,
) {
  return useCallback(
    (idx: number, source: SegmentSelectSource, opts?: SegmentSelectAtOptions) => {
      if (isListSegmentSelectSource(source)) {
        setSelectedIdxUi(idx, opts);
        return;
      }
      if (source === "waveformKeyboard") {
        setSelectedIdxUi(idx, opts);
        return;
      }
      startTransition(() => {
        setSelectedIdxUi(idx, opts);
      });
    },
    [setSelectedIdxUi],
  );
}
