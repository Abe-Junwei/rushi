import { useCallback, useState } from "react";
import { useLlmEnvRuntimeRevision } from "../hooks/useLlmEnvRuntimeRevision";
import type { SegmentDto } from "../tauri/projectApi";
import type { BusyReason } from "./useProjectCrudController";
import { useFindReplaceController } from "./useFindReplaceController";
import { usePostTranscribeOrchestrationController } from "./usePostTranscribeOrchestrationController";
import { useCorrectSuggestionsController } from "./useCorrectSuggestionsController";
import { useEditorCorrectionCatalog } from "./useEditorCorrectionCatalog";
import { useEditorSegmentCorrectPopover } from "./useEditorSegmentCorrectPopover";
import { segmentsWithDraftsApplied } from "../services/segmentDirtyRead";
import { segmentCanConfirmEdit } from "../services/segmentConfirmEligible";

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
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
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
    segmentsRef,
    setSegments,
    setSelectedIdx,
    flushSegmentTextDrafts,
    updateSegmentText,
    pushUndo,
    dirty,
    setError,
    saveSegments,
    transcribeWarnings = [],
  } = args;

  const [llmRuntimeEpoch, setLlmRuntimeEpoch] = useState(0);
  const llmEnvRevision = useLlmEnvRuntimeRevision();
  const bumpLlmRuntimeChanged = useCallback(() => {
    setLlmRuntimeEpoch((n) => n + 1);
  }, []);

  const findReplace = useFindReplaceController({
    busy,
    currentFileId,
    segments,
    segmentsRef,
    selectedIdx,
    flushSegmentTextDrafts,
    setSelectedIdx,
    updateSegmentText,
    setSegments,
    pushUndo,
    saveSegments,
  });

  const editorCorrectionCatalog = useEditorCorrectionCatalog({
    enabled: Boolean(currentFileId),
  });

  const editorSegmentCorrect = useEditorSegmentCorrectPopover({
    busy,
    segmentsRef,
    suggestionsForSurface: editorCorrectionCatalog.suggestionsForSurface,
    updateSegmentText,
  });

  const canConfirmSegmentEdit = useCallback(
    (segmentIdx: number) => {
      if (!currentFileId || busy) return false;
      return segmentCanConfirmEdit(
        segmentsWithDraftsApplied(segments),
        dirty.getSavedSnapshot(),
        segmentIdx,
      );
    },
    [busy, currentFileId, dirty, segments],
  );

  const correctSuggestions = useCorrectSuggestionsController({
    busy,
    currentFileId,
    openFindReplace: findReplace.openFindReplace,
    setError,
  });

  const postTranscribeOrchestration = usePostTranscribeOrchestrationController({
    busy,
    transcribePreviewActive: busyReason === "transcribe",
    currentFileId,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSegments,
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
    correctSuggestions,
    correctionRules: postTranscribeOrchestration,
    postTranscribeOrchestration,
  };
}
