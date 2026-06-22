import { useLayoutEffect, type RefObject } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import { reconcileSelectionChromeFromReact } from "../services/selection/reconcileSelectionChromeFromReact";

export function useReconcileSelectionChromeFromReact(args: {
  controller: ProjectControllerApi;
  segmentListRef: RefObject<HTMLDivElement | null>;
  tierScrollRef: TranscriptionLayerApi["tierScrollRef"];
}): void {
  const { controller: c, segmentListRef, tierScrollRef } = args;

  useLayoutEffect(() => {
    const overlayRoot =
      tierScrollRef.current?.querySelector(".waveform-timeline-overlay-layer") ?? null;
    reconcileSelectionChromeFromReact({
      fileId: c.currentFileId,
      primaryIdx: c.selectedIdx,
      selectedIndices: c.selectedIndicesArray,
      segments: c.segments,
      listRoot: segmentListRef.current,
      overlayRoot,
    });
  }, [
    c.currentFileId,
    c.selectedIdx,
    c.selectedIndicesArray,
    c.segments,
    segmentListRef,
    tierScrollRef,
  ]);
}
