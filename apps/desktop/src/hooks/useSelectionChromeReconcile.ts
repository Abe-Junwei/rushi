import { useLayoutEffect, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { reconcileSelectionChromeFromReact } from "../services/selection/reconcileSelectionChromeFromReact";
import { resetSelectionChrome } from "../services/selection/selectionChromeStore";

export function useSelectionChromeReconcile(input: {
  fileId: string | null;
  primaryIdx: number;
  selectedIndicesArray: readonly number[];
  segments: readonly SegmentDto[];
  segmentListRef: RefObject<HTMLElement | null>;
  tierScrollRef: RefObject<HTMLElement | null>;
}): void {
  useLayoutEffect(() => {
    if (input.segments.length === 0) {
      resetSelectionChrome(input.fileId);
      return;
    }

    const listRoot = input.segmentListRef.current;
    const tier = input.tierScrollRef.current;
    const overlayRoot = tier?.querySelector(".waveform-timeline-overlay-layer") ?? null;

    reconcileSelectionChromeFromReact({
      fileId: input.fileId,
      primaryIdx: input.primaryIdx,
      selectedIndices: input.selectedIndicesArray,
      segments: input.segments,
      listRoot,
      overlayRoot,
    });
  }, [
    input.fileId,
    input.primaryIdx,
    input.selectedIndicesArray,
    input.segmentListRef,
    input.segments,
    input.tierScrollRef,
  ]);
}
