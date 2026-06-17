import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  commitSegmentTextDraftsForStructureMutation,
  flushSegmentTextDrafts as flushSegmentTextDraftsImpl,
  publishSegmentStructureMutation,
  publishSegmentTextBulkMutation,
  publishTranscribeSegmentClear,
  publishTranscribeSegmentRestore,
  type SegmentListNext,
} from "./flushSegmentTextDrafts";

export type SegmentPublishApi = {
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  flushSegmentTextDrafts: (
    options?: Parameters<typeof flushSegmentTextDraftsImpl>[2],
  ) => void;
  commitTextDraftsForStructureMutation: () => void;
  publishStructure: (next: SegmentListNext) => void;
  publishTextBulk: (next: SegmentListNext) => void;
  publishTranscribeClear: () => void;
  publishTranscribeRestore: (next: SegmentDto[]) => void;
};

/** Editor stack 边界：封装 segmentsRef 写入，下游 controller 只经 publish API 变更语段。 */
export function createSegmentPublishApi(
  segmentsRef: MutableRefObject<SegmentDto[]>,
  setSegments: Dispatch<SetStateAction<SegmentDto[]>>,
): SegmentPublishApi {
  const getCurrentSegmentsSnapshot = () => segmentsRef.current;
  return {
    getCurrentSegmentsSnapshot,
    flushSegmentTextDrafts: (options) =>
      flushSegmentTextDraftsImpl(segmentsRef, setSegments, options),
    commitTextDraftsForStructureMutation: () =>
      commitSegmentTextDraftsForStructureMutation(segmentsRef, setSegments),
    publishStructure: (next) => publishSegmentStructureMutation(segmentsRef, setSegments, next),
    publishTextBulk: (next) => publishSegmentTextBulkMutation(segmentsRef, setSegments, next),
    publishTranscribeClear: () => publishTranscribeSegmentClear(segmentsRef, setSegments),
    publishTranscribeRestore: (next) =>
      publishTranscribeSegmentRestore(segmentsRef, setSegments, next),
  };
}
