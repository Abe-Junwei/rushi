import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  publishSegmentStructureMutation,
  publishSegmentTextBulkMutation,
  publishTranscribeSegmentClear,
  publishTranscribeSegmentRestore,
  type SegmentListNext,
} from "./flushSegmentTextDrafts";
import { flushCm6TextProjection } from "../components/editor/core/onDocChanged";

export type SegmentPublishApi = {
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  /** Sync CM6 text into SegmentDto[] (no undo). Used before structure mutations. */
  commitTextDraftsForStructureMutation: () => void;
  publishStructure: (next: SegmentListNext) => void;
  /** Live drag preview: React state only; ref reconciles on next render, commit via publishStructure. */
  publishStructureLive: (updater: (prev: SegmentDto[]) => SegmentDto[]) => void;
  publishTextBulk: (next: SegmentListNext) => void;
  publishTranscribeClear: () => void;
  publishTranscribeRestore: (next: SegmentDto[]) => void;
};

/** Editor stack 边界：封装最新 snapshot 读取；下游 controller 只经 publish API 变更语段。 */
export function createSegmentPublishApi(
  segmentsRef: MutableRefObject<SegmentDto[]>,
  setSegments: Dispatch<SetStateAction<SegmentDto[]>>,
): SegmentPublishApi {
  const getCurrentSegmentsSnapshot = () => segmentsRef.current;
  const remember = (next: SegmentDto[] | null): void => {
    if (next) segmentsRef.current = next;
  };
  return {
    getCurrentSegmentsSnapshot,
    commitTextDraftsForStructureMutation: () => {
      flushCm6TextProjection({
        baseline: getCurrentSegmentsSnapshot(),
        updateSegmentText: (idx, text) => {
          const prev = segmentsRef.current;
          const cur = prev[idx];
          if (!cur || cur.text === text) return;
          const next = [...prev];
          next[idx] = { ...cur, text };
          segmentsRef.current = next;
          setSegments(next);
        },
      });
    },
    publishStructure: (next) => {
      remember(publishSegmentStructureMutation(getCurrentSegmentsSnapshot, setSegments, next));
    },
    publishStructureLive: (updater) => {
      setSegments(updater);
    },
    publishTextBulk: (next) => {
      remember(publishSegmentTextBulkMutation(getCurrentSegmentsSnapshot, setSegments, next));
    },
    publishTranscribeClear: () => {
      remember(publishTranscribeSegmentClear(getCurrentSegmentsSnapshot, setSegments));
    },
    publishTranscribeRestore: (next) => {
      remember(publishTranscribeSegmentRestore(getCurrentSegmentsSnapshot, setSegments, next));
    },
  };
}
