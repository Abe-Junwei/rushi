import { useCallback, useState } from "react";
import { useLlmEnvRuntimeRevision } from "../hooks/useLlmEnvRuntimeRevision";
import type { SegmentDto } from "../tauri/projectApi";
import type { BusyReason } from "./useProjectCrudController";
import { useFindReplaceController } from "./useFindReplaceController";
import { usePostTranscribeOrchestrationController } from "./usePostTranscribeOrchestrationController";
import { useEditorCorrectionCatalog } from "./useEditorCorrectionCatalog";
import { useEditorSegmentCorrectPopover } from "./useEditorSegmentCorrectPopover";
import { segmentCanFinalize } from "../services/segmentConfirmEligible";
import type { SegmentPublishApi } from "./segmentPublishApi";

type SegmentDirtyApi = {
  getSavedSnapshot: () => SegmentDto[];
};

type Args = {
  busy: boolean;
  busyReason: BusyReason | null;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  currentFileId: string | null;
  selectedIdx: number;
  segments: SegmentDto[];
  segmentPublish: SegmentPublishApi;
  setSelectedIdx: (idx: number) => void;
  flushSegmentTextDrafts: () => void;
  updateSegmentText: (idx: number, text: string) => void;
  pushUndo: () => void;
  dirty: SegmentDirtyApi;
  setError: React.Dispatch<React.SetStateAction<string>>;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
    explicitPairs?: import("../tauri/fileApi").CorrectionExplicitPair[];
  }) => Promise<boolean>;
  transcribeWarnings?: string[];
};

export function useProjectEditorToolsController(args: Args) {
  const {
    busy,
    busyReason,
    beginBusy,
    endBusy,
    currentFileId,
    selectedIdx,
    segments,
    segmentPublish,
    setSelectedIdx,
    flushSegmentTextDrafts,
    updateSegmentText,
    pushUndo,
    setError,
    saveSegments,
    transcribeWarnings = [],
  } = args;

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;

  const [llmRuntimeEpoch, setLlmRuntimeEpoch] = useState(0);
  const llmEnvRevision = useLlmEnvRuntimeRevision();
  const bumpLlmRuntimeChanged = useCallback(() => {
    setLlmRuntimeEpoch((n) => n + 1);
  }, []);

  const findReplace = useFindReplaceController({
    busy,
    currentFileId,
    segments,
    segmentPublish,
    selectedIdx,
    flushSegmentTextDrafts,
    setSelectedIdx,
    updateSegmentText,
    pushUndo,
    saveSegments,
  });

  const editorCorrectionCatalog = useEditorCorrectionCatalog({
    enabled: Boolean(currentFileId),
  });

  const editorSegmentCorrect = useEditorSegmentCorrectPopover({
    busy,
    getCurrentSegmentsSnapshot,
    suggestionsForSurface: editorCorrectionCatalog.suggestionsForSurface,
    updateSegmentText,
  });

  const canConfirmSegmentEdit = useCallback(
    (segmentIdx: number) => {
      if (!currentFileId) return false;
      return segmentCanFinalize(segments, segmentIdx, busy);
    },
    [busy, currentFileId, segments],
  );

  const postTranscribeOrchestration = usePostTranscribeOrchestrationController({
    busy,
    transcribePreviewActive: busyReason === "transcribe",
    currentFileId,
    segments,
    segmentPublish,
    flushSegmentTextDrafts,
    setSelectedIdx,
    pushUndo,
    setError,
    saveSegments,
    transcribeWarnings,
    llmRuntimeEpoch,
    llmEnvRevision,
    beginBusy,
    endBusy,
  });

  return {
    llmRuntimeEpoch,
    bumpLlmRuntimeChanged,
    canConfirmSegmentEdit,
    findReplace,
    editorCorrectionCatalog,
    editorSegmentCorrect,
    correctionRules: postTranscribeOrchestration,
    postTranscribeOrchestration,
  };
}
