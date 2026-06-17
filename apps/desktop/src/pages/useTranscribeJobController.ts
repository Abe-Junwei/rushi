import { useRef } from "react";
import * as p1 from "../tauri/projectApi";
import type { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { useProjectEditorState } from "./useProjectEditorState";
import type { useProjectBusyState } from "./useProjectBusyState";
import type { useSegmentMutationController } from "./useSegmentMutationController";
import {
  segmentsHaveNonEmptyText,
  type LocalTranscribePreflight,
} from "./transcribeJobHelpers";
import { useTranscribeJobExecute } from "./useTranscribeJobExecute";
import { useTranscribeJobPreflight } from "./useTranscribeJobPreflight";
import type { SegmentPublishApi } from "./segmentPublishApi";
import type { BusyReason } from "./useProjectCrudController";
import type { ExecuteTranscribeOptions, ExecuteTranscribeResult } from "./useTranscribeJobExecute";

export type { LocalTranscribePreflight } from "./transcribeJobHelpers";

type CloseGate = Pick<
  ReturnType<typeof useProjectCloseGateController>,
  "openFileWrapped"
>;
type Editor = Pick<
  ReturnType<typeof useProjectEditorState>,
  "current" | "currentFileId" | "segments" | "setCurrent"
>;
type Busy = Pick<ReturnType<typeof useProjectBusyState>, "busy" | "beginBusy" | "endBusy">;
type Mutations = Pick<ReturnType<typeof useSegmentMutationController>, "resetMutationHistory">;

type Deps = {
  busy: Busy["busy"];
  busyReason: BusyReason | null;
  beginBusy: Busy["beginBusy"];
  endBusy: Busy["endBusy"];
  current: Editor["current"];
  currentFileId: Editor["currentFileId"];
  segments: Editor["segments"];
  segmentPublish: SegmentPublishApi;
  setCurrent: Editor["setCurrent"];
  setError: (msg: string) => void;
  closeGate: CloseGate;
  mutations: Mutations;
  localTranscribePreflight: LocalTranscribePreflight;
  sttOnlineRuntimeEpoch?: number;
  clearScheduledAutoSave?: () => void;
  onTranscribeSuccess?: (out: p1.RunTranscribeOutcome) => void;
};

export function useTranscribeJobController(deps: Deps) {
  const {
    busy,
    busyReason,
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segments,
    segmentPublish,
    setCurrent,
    setError,
    closeGate,
    mutations,
    localTranscribePreflight,
    sttOnlineRuntimeEpoch = 0,
    clearScheduledAutoSave,
    onTranscribeSuccess,
  } = deps;

  const executeRef = useRef<(opts?: ExecuteTranscribeOptions) => Promise<ExecuteTranscribeResult>>(
    async () => ({ ok: true }),
  );

  const preflight = useTranscribeJobPreflight({
    busy,
    current,
    currentFileId,
    setError,
    sttOnlineRuntimeEpoch,
    onConfirmStart: async () => {
      await executeRef.current();
    },
  });

  const execute = useTranscribeJobExecute({
    busy,
    busyReason,
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segmentPublish,
    setCurrent,
    setError,
    closeGate,
    mutations,
    localTranscribePreflight,
    transcribeSource: preflight.transcribeSource,
    setTranscribeStartDialogOpen: preflight.setTranscribeStartDialogOpen,
    clearScheduledAutoSave,
    onTranscribeSuccess,
  });

  executeRef.current = execute.executeTranscribe;

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;

  return {
    transcribeHints: execute.transcribeHints,
    transcribeWarnings: execute.transcribeWarnings,
    setTranscribeHints: execute.setTranscribeHints,
    setTranscribeWarnings: execute.setTranscribeWarnings,
    transcribeProgress: execute.transcribeProgress,
    transcribeCancelling: execute.transcribeCancelling,
    transcribeFailureDiag: execute.transcribeFailureDiag,
    setTranscribeFailureDiag: execute.setTranscribeFailureDiag,
    transcribeStartDialogOpen: preflight.transcribeStartDialogOpen,
    transcribeStartHasExistingText: segmentsHaveNonEmptyText(getCurrentSegmentsSnapshot()),
    overwriteSegmentCount: segments.length,
    transcribeVocabularyPreflightLines: preflight.transcribeVocabularyPreflightLines,
    transcribeSource: preflight.transcribeSource,
    setTranscribeSource: preflight.setTranscribeSource,
    onlineTranscribeReady: preflight.onlineTranscribeReady,
    requestTranscribe: preflight.requestTranscribe,
    cancelTranscribe: execute.cancelTranscribe,
    cancelTranscribeStart: preflight.cancelTranscribeStart,
    confirmTranscribeStart: preflight.confirmTranscribeStart,
    executeTranscribeForBatch: (opts?: ExecuteTranscribeOptions) => execute.executeTranscribe(opts),
    applyDetailClearTranscribe: execute.applyDetailClearTranscribe,
  };
}
