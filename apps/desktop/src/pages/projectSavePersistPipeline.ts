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
import type { SegmentPublishApi } from "./segmentPublishApi";

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
  segmentPublish: SegmentPublishApi;
  selectedIdxRef: MutableRefObject<number>;
  savedSnapshot: SegmentDto[];
  pendingAiRevisedUids: Set<string>;
  setCurrent: Dispatch<SetStateAction<ProjectDetail | null>>;
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
    segmentPublish,
    selectedIdxRef,
    savedSnapshot,
    pendingAiRevisedUids,
    setCurrent,
    setSelectedIdx,
    options,
  } = args;

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;
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
  segmentPublish.publishTextBulk(staged);
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
    segmentPublish.publishStructure(segs);
    const ni = findSegmentIndexByUid(segs, prevUid);
    setSelectedIdx(
      ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1)),
    );
  }
  pendingAiRevisedUids.clear();
  return { snapshotBase };
}
