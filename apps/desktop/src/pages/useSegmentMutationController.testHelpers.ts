import { useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { useSegmentMutationController } from "./useSegmentMutationController";
import { reconcileSegmentsRefWithState } from "./segmentSegmentsRefSync";
import { createSegmentPublishApi } from "./segmentPublishApi";

export function makeSeg(props: Partial<SegmentDto> & { text: string; start_sec: number; end_sec: number }): SegmentDto {
  return {
    idx: 0,
    confidence: null,
    low_confidence: false,
    detail: null,
    ...props,
  };
}

export function useTestSegmentMutationController(
  initial: SegmentDto[],
  busy = false,
  onSelectionCollapsed?: (idx: number) => void,
  opts?: {
    getPlayheadSec?: () => number;
    onStructurePlaybackRemap?: (
      playheadSec: number,
      segments?: readonly SegmentDto[],
    ) => void;
  },
) {
  const [segments, setSegments] = useState(initial);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const segmentsRef = useRef(segments);
  const selectedIdxRef = useRef(selectedIdx);
  reconcileSegmentsRefWithState(segmentsRef, segments);
  selectedIdxRef.current = selectedIdx;
  const [error, setError] = useState("");
  const segmentPublish = createSegmentPublishApi(segmentsRef, setSegments);

  const mutations = useSegmentMutationController({
    segmentPublish,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    onSelectionCollapsed,
    getPlayheadSec: opts?.getPlayheadSec,
    onStructurePlaybackRemap: opts?.onStructurePlaybackRemap,
  });

  return { mutations, segments, selectedIdx, setSelectedIdx, error, segmentsRef, segmentPublish };
}
