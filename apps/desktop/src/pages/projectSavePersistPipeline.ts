import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import * as fileApi from "../tauri/fileApi";
import * as p1 from "../tauri/projectApi";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import {
  findSegmentIndexByUid,
  normalizeSegmentList,
  prepareSegmentsForPersist,
  segmentsEqualForPersist,
} from "./segmentListHelpers";
import { segmentsToLearnBaselineAligned } from "../services/correctionLearnBaseline";
import {
  applyStagePatchesBeforePersist,
  type FinalizeStageIntent,
} from "../services/segmentStagePersist";
import {
  publishSegmentStructureMutation,
  publishSegmentTextBulkMutation,
} from "./flushSegmentTextDrafts";

export type SavePersistPipelineOptions = {
  quiet?: boolean;
  countHits?: boolean;
  explicitPairs?: fileApi.CorrectionExplicitPair[];
  learnBaselineTexts?: fileApi.LearnBaselineText[];
  finalizeIntent?: FinalizeStageIntent;
  aiRevisedUids?: ReadonlySet<string>;
};

export type SavePersistPipelineArgs = {
  current: ProjectDetail;
  currentFileId: string;
  segmentsRef: MutableRefObject<SegmentDto[]>;
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  selectedIdxRef: MutableRefObject<number>;
  savedSnapshot: SegmentDto[];
  pendingAiRevisedUids: Set<string>;
  setCurrent: Dispatch<SetStateAction<ProjectDetail | null>>;
  setSegments: Dispatch<SetStateAction<SegmentDto[]>>;
  setSelectedIdx: Dispatch<SetStateAction<number>>;
  options?: SavePersistPipelineOptions;
};

export type SavePersistPipelineOutcome = {
  snapshotBase: SegmentDto[];
};

export async function runProjectSavePersistPipeline(
  args: SavePersistPipelineArgs,
): Promise<SavePersistPipelineOutcome> {
  const {
    current,
    currentFileId,
    segmentsRef,
    getCurrentSegmentsSnapshot,
    selectedIdxRef,
    savedSnapshot,
    pendingAiRevisedUids,
    setCurrent,
    setSegments,
    setSelectedIdx,
    options,
  } = args;

  const aiRevisedUids = new Set<string>([
    ...pendingAiRevisedUids,
    ...(options?.aiRevisedUids ?? []),
  ]);
  const countHits = options?.countHits ?? !options?.finalizeIntent;
  const currentSegments = getCurrentSegmentsSnapshot();
  const staged = applyStagePatchesBeforePersist(currentSegments, savedSnapshot, {
    finalizeIntent: options?.finalizeIntent,
    aiRevisedUids: aiRevisedUids.size > 0 ? aiRevisedUids : undefined,
  });
  publishSegmentTextBulkMutation(segmentsRef, setSegments, staged);
  const learnBaselineTexts = countHits
    ? (options?.learnBaselineTexts ?? segmentsToLearnBaselineAligned(savedSnapshot, staged))
    : undefined;
  const normalized = prepareSegmentsForPersist(staged, 0);
  await fileApi.fileSaveSegments(currentFileId, normalized, {
    countHits,
    explicitPairs: options?.explicitPairs,
    learnBaselineTexts,
  });
  const [projectDetail, fileDetail] = await Promise.all([
    p1.projectLoad(current.id),
    fileApi.loadFile(currentFileId),
  ]);
  setCurrent((prev) =>
    prev?.id === projectDetail.id && prev.updated_at_ms === projectDetail.updated_at_ms
      ? prev
      : projectDetail,
  );
  const persistedSegments = getCurrentSegmentsSnapshot();
  const prevUid = persistedSegments[selectedIdxRef.current]?.uid;
  const segs = normalizeSegmentList(fileDetail.segments);
  const snapshotBase = segmentsEqualForPersist(segs, persistedSegments)
    ? persistedSegments
    : segs;
  if (!segmentsEqualForPersist(segs, persistedSegments)) {
    publishSegmentStructureMutation(segmentsRef, setSegments, segs);
    const ni = findSegmentIndexByUid(segs, prevUid);
    setSelectedIdx(
      ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1)),
    );
  }
  pendingAiRevisedUids.clear();
  return { snapshotBase };
}
