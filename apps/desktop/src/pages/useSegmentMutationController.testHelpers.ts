import { useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { useSegmentMutationController } from "./useSegmentMutationController";

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
) {
  const [segments, setSegments] = useState(initial);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const segmentsRef = useRef(segments);
  const selectedIdxRef = useRef(selectedIdx);
  segmentsRef.current = segments;
  selectedIdxRef.current = selectedIdx;
  const [error, setError] = useState("");

  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
    onSelectionCollapsed,
  });

  return { mutations, segments, selectedIdx, setSelectedIdx, error };
}
