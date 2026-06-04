import { useCallback, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { BusyReason } from "./useProjectCrudController";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { useLexiconProofreadController } from "./useLexiconProofreadController";
import { useFindReplaceController } from "./useFindReplaceController";
import { useCorrectionRulesController } from "./useCorrectionRulesController";
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
};

export function useProjectEditorToolsController(args: Args) {
  const {
    busy,
    busyReason,
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
  } = args;

  const [llmRuntimeEpoch, setLlmRuntimeEpoch] = useState(0);
  const bumpLlmRuntimeChanged = useCallback(() => {
    setLlmRuntimeEpoch((n) => n + 1);
  }, []);
  const { keychainReady: llmKeychainReady, checking: llmKeychainChecking } =
    useLlmKeychainReady(llmRuntimeEpoch);
  const { presentation: llmPresentation } = useLlmEnvStatus(llmRuntimeEpoch);

  const transcribePreviewActive = busy && busyReason === "transcribe";
  const llmShared = {
    llmRuntimeEpoch,
    llmKeychainReady,
    llmKeychainChecking,
    llmCapabilityOk: llmPresentation.ok,
    llmCapabilityBlockReason: llmPresentation.blockReason,
  };

  const lexiconProofread = useLexiconProofreadController({
    busy,
    transcribePreviewActive,
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSegments,
    setSelectedIdx,
    pushUndo,
    setError,
    ...llmShared,
  });

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

  const correctionRules = useCorrectionRulesController({
    busy,
    currentFileId,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSegments,
    pushUndo,
    setError,
    saveSegments,
  });

  return {
    bumpLlmRuntimeChanged,
    canConfirmSegmentEdit,
    lexiconProofread,
    findReplace,
    editorCorrectionCatalog,
    editorSegmentCorrect,
    correctSuggestions,
    correctionRules,
  };
}
