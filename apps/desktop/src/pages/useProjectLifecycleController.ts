import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import { useExportController } from "./useExportController";
import { useProjectCrudController } from "./useProjectCrudController";
import { useSegmentMutationController } from "./useSegmentMutationController";
import { useProjectBusyState } from "./useProjectBusyState";
import { useProjectListState } from "./useProjectListState";
import { useProjectEditorState } from "./useProjectEditorState";
import { useAutoPunctuateController } from "./useAutoPunctuateController";
import { useSegmentRefineController } from "./useSegmentRefineController";
import { useLexiconProofreadController } from "./useLexiconProofreadController";
import { useFindReplaceController } from "./useFindReplaceController";
import { useCorrectionRulesController } from "./useCorrectionRulesController";
import { useCorrectSuggestionsController } from "./useCorrectSuggestionsController";
import { useGlossaryLearnPromptController } from "./useGlossaryLearnPromptController";
import { useManualCorrectionMemoryDialog } from "./useManualCorrectionMemoryDialog";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import {
  useProjectCloseGateController,
  type ProjectCloseGateControllerApi,
} from "./useProjectCloseGateController";
import { useSegmentDirtyState } from "./useSegmentDirtyState";
import { useAutoSaveSegments } from "./useAutoSaveSegments";
import {
  useTranscribeJobController,
  type LocalTranscribePreflight,
} from "./useTranscribeJobController";
import {
  findSegmentIndexByUid,
  normalizeSegmentList,
  prepareSegmentsForPersist,
  segmentsEqualForPersist,
} from "./segmentListHelpers";
import { segmentsToLearnBaseline } from "../services/correctionLearnBaseline";
import { segmentsWithDraftsApplied } from "../services/segmentDirtyRead";
import { segmentCanConfirmEdit } from "../services/segmentConfirmEligible";
import { waitForSaveIdle } from "../services/waitForSaveIdle";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { toast } from "../services/ui/toast";
import { useEditorCorrectionCatalog } from "./useEditorCorrectionCatalog";
import { useEditorSegmentCorrectPopover } from "./useEditorSegmentCorrectPopover";
import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";

export type { ProjectLifecycleApi } from "./ProjectLifecycleApi";
export type { BusyReason } from "./useProjectCrudController";
export type { LocalTranscribePreflight };

export function useProjectLifecycleController(
  localTranscribePreflight: LocalTranscribePreflight = () => null,
  sttOnlineRuntimeEpoch = 0,
): ProjectLifecycleApi {
  const { busy, busyReason, beginBusy, endBusy } = useProjectBusyState();
  const [error, setError] = useState<string>("");
  const { projects, refreshProjects } = useProjectListState(setError);

  const {
    current,
    setCurrent,
    currentFileId,
    segments,
    setSegments,
    selectedIdx,
    setSelectedIdx,
    audioSrc,
    setAudioSrc,
    segmentsRef,
    selectedIdxRef,
    openFile,
    closeFile,
    refreshCurrentProject: refreshCurrentProjectBase,
    applyDetailBase,
  } = useProjectEditorState(setError);

  const [newName, setNewName] = useState("未命名项目");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const closeGateRef = useRef<ProjectCloseGateControllerApi | null>(null);

  const mutations = useSegmentMutationController({
    segmentsRef,
    setSegments,
    selectedIdxRef,
    setSelectedIdx,
    setError,
    busy,
  });

  const dirty = useSegmentDirtyState({
    currentFileId,
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
  });

  const glossaryLearn = useGlossaryLearnPromptController({ setError });
  const manualCorrectionMemory = useManualCorrectionMemoryDialog({
    busy,
    setError,
    checkGlossaryLearnAfterSave: glossaryLearn.checkGlossaryLearnAfterSave,
  });

  const saveInFlightRef = useRef(false);
  const clearAutoSaveRef = useRef<() => void>(() => {});
  const notifySegmentsPersistedRef = useRef<() => void>(() => {});

  const saveSegments = useCallback(
    async (options?: {
      quiet?: boolean;
      countHits?: boolean;
      explicitPairs?: fileApi.CorrectionExplicitPair[];
      learnBaselineTexts?: fileApi.LearnBaselineText[];
    }): Promise<boolean> => {
    if (saveInFlightRef.current) return false;
    if (!current || !currentFileId) {
      setError("请先打开一个文件后再保存");
      return false;
    }
    if (busy) {
      setError("处理中，请稍候再保存");
      return false;
    }
    clearAutoSaveRef.current();
    saveInFlightRef.current = true;
    setError("");
    try {
      mutations.flushSegmentTextDrafts();
      const countHits = options?.countHits ?? false;
      const learnBaselineTexts = countHits
        ? (options?.learnBaselineTexts ?? segmentsToLearnBaseline(dirty.getSavedSnapshot()))
        : undefined;
      const normalized = prepareSegmentsForPersist(segmentsRef.current, 0);
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
      const prevUid = segmentsRef.current[selectedIdxRef.current]?.uid;
      const segs = normalizeSegmentList(fileDetail.segments);
      const snapshotBase = segmentsEqualForPersist(segs, segmentsRef.current)
        ? segmentsRef.current
        : segs;
      if (!segmentsEqualForPersist(segs, segmentsRef.current)) {
        segmentsRef.current = segs;
        setSegments(segs);
        const ni = findSegmentIndexByUid(segs, prevUid);
        setSelectedIdx(
          ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1)),
        );
      }
      dirty.setSavedSnapshot(snapshotBase);
      notifySegmentsPersistedRef.current();
      if (!options?.quiet) {
        toast.success("保存成功");
      }
      void glossaryLearn.checkGlossaryLearnAfterSave();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      saveInFlightRef.current = false;
    }
  }, [
    busy,
    current,
    currentFileId,
    mutations,
    dirty,
    setCurrent,
    setSegments,
    setSelectedIdx,
    segmentsRef,
    selectedIdxRef,
    glossaryLearn.checkGlossaryLearnAfterSave,
  ],
  );

  const confirmSegmentEditAndAdvance = useCallback(
    async (segmentIdx: number): Promise<boolean> => {
      if (!current || !currentFileId || busy) return false;
      if (segmentIdx < 0 || segmentIdx >= segmentsRef.current.length) return false;
      clearAutoSaveRef.current();
      mutations.flushSegmentTextDrafts();
      const nextIdx = Math.min(segmentIdx + 1, segmentsRef.current.length - 1);
      if (dirty.hasUnsavedSegmentChanges()) {
        if (saveInFlightRef.current) {
          const idle = await waitForSaveIdle(saveInFlightRef);
          if (!idle) {
            toast.warning("保存语段失败：自动保存耗时过长，请稍候再试");
            return false;
          }
        }
        const saved = await saveSegments({ quiet: true, countHits: true });
        if (!saved) {
          toast.warning("保存语段失败：请稍候再试（可能正在自动保存）");
          return false;
        }
      }
      if (nextIdx !== selectedIdxRef.current) {
        setSelectedIdx(nextIdx);
      }
      return true;
    },
    [
      busy,
      current,
      currentFileId,
      dirty,
      mutations,
      saveSegments,
      segmentsRef,
      selectedIdxRef,
      setSelectedIdx,
    ],
  );

  const autoSave = useAutoSaveSegments({
    enabled: Boolean(currentFileId),
    currentFileId,
    segments,
    busy,
    saveInFlightRef,
    hasUnsavedSegmentChanges: dirty.hasUnsavedSegmentChanges,
    saveSegments,
    registerClearScheduled: (fn) => {
      clearAutoSaveRef.current = fn;
    },
    registerOnPersisted: (fn) => {
      notifySegmentsPersistedRef.current = fn;
    },
  });

  const applyDetailBaseOnly = useCallback(
    (d: ProjectDetail) => {
      mutations.resetMutationHistory();
      applyDetailBase(d);
      setPickedPath(null);
    },
    [mutations, applyDetailBase],
  );

  const transcribeJob = useTranscribeJobController({
    busy,
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segments,
    segmentsRef,
    setCurrent,
    setSegments,
    setError,
    closeGate: {
      openFileWrapped: async (fileId: string) => {
        const gate = closeGateRef.current;
        if (!gate) throw new Error("closeGate not ready");
        await gate.openFileWrapped(fileId);
      },
    },
    mutations,
    localTranscribePreflight,
    sttOnlineRuntimeEpoch,
  });

  const applyDetail = useCallback(
    (d: ProjectDetail) => {
      applyDetailBaseOnly(d);
      transcribeJob.applyDetailClearTranscribe(d);
    },
    [applyDetailBaseOnly, transcribeJob],
  );

  const closeGate = useProjectCloseGateController({
    applyDetail,
    beginBusy,
    busy,
    closeFile,
    current,
    currentFileId,
    dirty,
    endBusy,
    openFile,
    saveSegments,
    setCurrent,
    setError,
    setTranscribeHints: transcribeJob.setTranscribeHints,
    resetMutationHistory: mutations.resetMutationHistory,
    projects,
  });
  closeGateRef.current = closeGate;

  const refreshCurrentProject = useCallback(async () => {
    if (busy || !current) return;
    await refreshCurrentProjectBase();
  }, [busy, current, refreshCurrentProjectBase]);

  const restoreEditorFromEditLog = useCallback(
    async (editLogId: number) => {
      if (busy) {
        toast.warning("处理中，请稍候再恢复");
        return;
      }
      if (!currentFileId) {
        toast.warning("请先打开一个文件");
        return;
      }
      const idle = await waitForSaveIdle(saveInFlightRef);
      if (!idle) {
        setError("保存尚未结束，请稍候再恢复");
        return;
      }
      clearAutoSaveRef.current();
      saveInFlightRef.current = true;
      beginBusy("save");
      setError("");
      try {
        mutations.resetMutationHistory();
        segmentDraftStore.resetAll();
        await p1.fileRestoreSegmentsFromEditLog(currentFileId, editLogId);
        const fd = await fileApi.loadFile(currentFileId);
        const prevUid = segmentsRef.current[selectedIdxRef.current]?.uid;
        const segs = normalizeSegmentList(fd.segments);
        flushSync(() => {
          segmentsRef.current = segs;
          setSegments(segs);
          const ni = findSegmentIndexByUid(segs, prevUid);
          setSelectedIdx(
            ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1)),
          );
        });
        dirty.setSavedSnapshot(segs);
        notifySegmentsPersistedRef.current();
        toast.success("已恢复到所选版本");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        saveInFlightRef.current = false;
        endBusy();
      }
    },
    [
      busy,
      currentFileId,
      beginBusy,
      endBusy,
      mutations,
      dirty,
      setSegments,
      setSelectedIdx,
      setError,
      segmentsRef,
      selectedIdxRef,
      clearAutoSaveRef,
      saveInFlightRef,
    ],
  );

  const pickAudio = useCallback(async () => {
    if (busy) return;
    setError("");
    try {
      const p = await p1.pickAudioPath();
      setPickedPath(p ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy]);

  const clearPickedAudio = useCallback(() => {
    setPickedPath(null);
  }, []);

  const crud = useProjectCrudController({
    pickedPath,
    newName,
    current,
    setError,
    beginBusy,
    endBusy,
    applyDetail,
    refreshProjects,
    mutations,
    setCurrent,
    setSegments,
    setAudioSrc,
    setTranscribeHints: transcribeJob.setTranscribeHints,
  });

  const [llmRuntimeEpoch, setLlmRuntimeEpoch] = useState(0);
  const bumpLlmRuntimeChanged = useCallback(() => {
    setLlmRuntimeEpoch((n) => n + 1);
  }, []);
  const { keychainReady: llmKeychainReady, checking: llmKeychainChecking } =
    useLlmKeychainReady(llmRuntimeEpoch);

  const autoPunctuate = useAutoPunctuateController({
    busy,
    transcribePreviewActive: busy && busyReason === "transcribe",
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    updateSegmentText: mutations.updateSegmentText,
    setError,
    llmRuntimeEpoch,
    llmKeychainReady,
    llmKeychainChecking,
  });

  const segmentRefine = useSegmentRefineController({
    busy,
    transcribePreviewActive: busy && busyReason === "transcribe",
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    setSegments,
    setSelectedIdx,
    pushUndo: mutations.pushUndo,
    setError,
    llmRuntimeEpoch,
    llmKeychainReady,
    llmKeychainChecking,
  });

  const lexiconProofread = useLexiconProofreadController({
    busy,
    transcribePreviewActive: busy && busyReason === "transcribe",
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    setSegments,
    setSelectedIdx,
    pushUndo: mutations.pushUndo,
    setError,
    llmRuntimeEpoch,
    llmKeychainReady,
    llmKeychainChecking,
  });

  const findReplace = useFindReplaceController({
    busy,
    currentFileId,
    segments,
    segmentsRef,
    selectedIdx,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    setSelectedIdx,
    updateSegmentText: mutations.updateSegmentText,
    setSegments,
    pushUndo: mutations.pushUndo,
    saveSegments,
  });

  const editorCorrectionCatalog = useEditorCorrectionCatalog({
    enabled: Boolean(currentFileId),
  });

  const editorSegmentCorrect = useEditorSegmentCorrectPopover({
    busy,
    segmentsRef,
    suggestionsForSurface: editorCorrectionCatalog.suggestionsForSurface,
    updateSegmentText: mutations.updateSegmentText,
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
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    setSegments,
    pushUndo: mutations.pushUndo,
    setError,
    saveSegments,
  });

  const openAppDataFolder = useCallback(async () => {
    if (busy) return;
    setError("");
    try {
      await p1.openAppDataFolder();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy]);

  const exports = useExportController({
    current,
    currentFileId,
    segmentsRef,
    setError,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    refreshProjects,
    applyDetail,
  });

  return {
    projects, current, currentFileId, segments, selectedIdx, setSelectedIdx,
    audioSrc, error, busy, busyReason, newName, setNewName, pickedPath,
    transcribeHints: transcribeJob.transcribeHints,
    transcribeProgress: transcribeJob.transcribeProgress,
    transcribeCancelling: transcribeJob.transcribeCancelling,
    transcribePreviewActive: busy && busyReason === "transcribe",
    transcribeOverwriteDialogOpen: transcribeJob.overwriteDialogOpen,
    transcribeOverwriteSegmentCount: transcribeJob.overwriteSegmentCount,
    transcribeVocabularyPreflightLines: transcribeJob.transcribeVocabularyPreflightLines,
    refreshProjects, pickAudio, clearPickedAudio,
    createProject: crud.createProject, createEmptyProject: crud.createEmptyProject, createProjectFromText: crud.createProjectFromText,
    loadProject: closeGate.loadProject,
    refreshCurrentProject,
    openFile: closeGate.openFileWrapped,
    restoreEditorFromEditLog,
    openLastEditorWorkspace: closeGate.openLastEditorWorkspace,
    closeFile: closeGate.closeFileWrapped, closeProject: closeGate.closeProjectWrapped,
    runTranscribe: transcribeJob.requestTranscribe,
    cancelTranscribe: transcribeJob.cancelTranscribe,
    confirmTranscribeOverwrite: transcribeJob.confirmTranscribeOverwrite,
    cancelTranscribeOverwrite: transcribeJob.cancelTranscribeOverwrite,
    saveSegments,
    confirmSegmentEditAndAdvance,
    canConfirmSegmentEdit,
    getSavedSnapshot: dirty.getSavedSnapshot,
    editorSpansForText: editorCorrectionCatalog.spansForText,
    editorCorrectPopover: editorSegmentCorrect.popover,
    editorCorrectPopoverSuggestions: editorSegmentCorrect.popoverSuggestions,
    openEditorCorrectPopover: editorSegmentCorrect.openPopover,
    closeEditorCorrectPopover: editorSegmentCorrect.closePopover,
    applyEditorInlineCorrection: editorSegmentCorrect.applyInlineCorrection,
    autoSaveFooterStatus: autoSave.autoSaveFooterStatus,
    deleteProject: crud.deleteProject,
    exportTxt: exports.exportTxt, exportSrt: exports.exportSrt, exportDocx: exports.exportDocx,
    exportDiagnosticBundle: exports.exportDiagnosticBundle, exportProjectBundle: exports.exportProjectBundle, importProjectBundle: exports.importProjectBundle,
    openAppDataFolder, applyDetail, setError, beginBusy, endBusy,
    undo: mutations.undo, redo: mutations.redo, updateSegmentText: mutations.updateSegmentText,
    updateSegmentTime: mutations.updateSegmentTime, updateSegmentBounds: mutations.updateSegmentBounds,
    splitAtSelection: () => mutations.splitAtSelection(selectedIdxRef.current),
    splitAtPlayhead: mutations.splitAtPlayhead,
    mergeWithNext: () => mutations.mergeWithNext(selectedIdxRef.current),
    mergeWithPrev: () => mutations.mergeWithPrev(selectedIdxRef.current),
    mergeWithNextAt: mutations.mergeWithNextAt, mergeWithPrevAt: mutations.mergeWithPrevAt,
    deleteSegmentAt: mutations.deleteSegmentAt, insertSegmentAfter: mutations.insertSegmentAfter,
    insertSegmentFromTimeRange: mutations.insertSegmentFromTimeRange,
    flushSegmentTextDrafts: mutations.flushSegmentTextDrafts,
    canAutoPunctuate: autoPunctuate.canAutoPunctuate,
    autoPunctuateBlockReason: autoPunctuate.autoPunctuateBlockReason,
    autoPunctuateDialog: autoPunctuate.dialog,
    requestAutoPunctuate: autoPunctuate.requestAutoPunctuate,
    confirmAutoPunctuateConsent: autoPunctuate.confirmAutoPunctuateConsent,
    confirmAutoPunctuateWriteback: autoPunctuate.confirmAutoPunctuateWriteback,
    cancelAutoPunctuate: autoPunctuate.cancelAutoPunctuate,
    canRefineSegments: segmentRefine.canRefineSegments,
    segmentRefineBlockReason: segmentRefine.segmentRefineBlockReason,
    segmentRefineDialog: segmentRefine.segmentRefineDialog,
    requestSegmentRefine: segmentRefine.requestSegmentRefine,
    confirmSegmentRefineConsent: segmentRefine.confirmSegmentRefineConsent,
    confirmSegmentRefineWriteback: segmentRefine.confirmSegmentRefineWriteback,
    cancelSegmentRefine: segmentRefine.cancelSegmentRefine,
    canLexiconProofread: lexiconProofread.canLexiconProofread,
    lexiconProofreadBlockReason: lexiconProofread.lexiconProofreadBlockReason,
    lexiconProofreadDialog: lexiconProofread.lexiconProofreadDialog,
    requestLexiconProofread: lexiconProofread.requestLexiconProofread,
    confirmLexiconProofreadConsent: lexiconProofread.confirmLexiconProofreadConsent,
    confirmLexiconProofreadWriteback: lexiconProofread.confirmLexiconProofreadWriteback,
    setLexiconAcceptRulesOnWriteback: lexiconProofread.setLexiconAcceptRulesOnWriteback,
    toggleLexiconProofreadOp: lexiconProofread.toggleLexiconProofreadOp,
    setAllLexiconProofreadOps: lexiconProofread.setAllLexiconProofreadOps,
    cancelLexiconProofread: lexiconProofread.cancelLexiconProofread,
    canFindReplace: findReplace.canFindReplace,
    findReplaceBlockReason: findReplace.findReplaceBlockReason,
    findReplaceDialog: findReplace.findReplaceDialog,
    openFindReplace: findReplace.openFindReplace,
    closeFindReplace: findReplace.closeFindReplace,
    setFindReplaceFindText: findReplace.setFindReplaceFindText,
    setFindReplaceReplaceText: findReplace.setFindReplaceReplaceText,
    findReplaceRunSearch: findReplace.findReplaceRunSearch,
    findReplaceSelectMatch: findReplace.findReplaceSelectMatch,
    findReplaceGoNext: findReplace.findReplaceGoNext,
    findReplaceGoPrev: findReplace.findReplaceGoPrev,
    findReplaceCurrent: findReplace.findReplaceCurrent,
    findReplaceRequestReplaceAll: findReplace.findReplaceRequestReplaceAll,
    findReplaceConfirmReplaceAll: findReplace.findReplaceConfirmReplaceAll,
    findReplaceCancelReplaceAllPreview: findReplace.findReplaceCancelReplaceAllPreview,
    findReplaceEditorHighlight: findReplace.findReplaceEditorHighlight,
    findReplaceReplaceAndNext: findReplace.findReplaceReplaceAndNext,
    canApplyCorrectionRules: correctionRules.canApplyCorrectionRules,
    correctionRulesBlockReason: correctionRules.correctionRulesBlockReason,
    correctionRulesDialog: correctionRules.correctionRulesDialog,
    requestCorrectionRules: () => {
      void correctionRules.requestCorrectionRules();
    },
    confirmCorrectionRulesWriteback: () => {
      void correctionRules.confirmCorrectionRulesWriteback();
    },
    cancelCorrectionRules: correctionRules.cancelCorrectionRules,
    canCorrectSuggestions: correctSuggestions.canCorrectSuggestions,
    correctSuggestionsBlockReason: correctSuggestions.correctSuggestionsBlockReason,
    correctSuggestionsDialog: correctSuggestions.correctSuggestionsDialog,
    requestCorrectSuggestions: (selectionOverride?: string) => {
      void correctSuggestions.requestCorrectSuggestions(selectionOverride);
    },
    applyCorrectSuggestion: correctSuggestions.applyCorrectSuggestion,
    cancelCorrectSuggestions: correctSuggestions.cancelCorrectSuggestions,
    openFindReplaceForCorrectSelection: correctSuggestions.openFindReplaceForCorrectSelection,
    glossaryLearnDialog: glossaryLearn.glossaryLearnDialog,
    dismissGlossaryLearnPrompt: glossaryLearn.dismissGlossaryLearnPrompt,
    confirmAddToGlossary: (row) => {
      void glossaryLearn.confirmAddToGlossary(row);
    },
    closeGlossaryLearnPrompt: glossaryLearn.closeGlossaryLearnPrompt,
    manualCorrectionMemoryDialog: manualCorrectionMemory.manualCorrectionMemoryDialog,
    openManualCorrectionMemoryDialog: manualCorrectionMemory.openManualCorrectionMemoryDialog,
    closeManualCorrectionMemoryDialog: manualCorrectionMemory.closeManualCorrectionMemoryDialog,
    setManualCorrectionRight: manualCorrectionMemory.setManualCorrectionRight,
    setManualCorrectionAlsoGlossary: manualCorrectionMemory.setManualCorrectionAlsoGlossary,
    confirmManualCorrectionMemory: () => {
      void manualCorrectionMemory.confirmManualCorrectionMemory();
    },
    bumpLlmRuntimeChanged,
    closeGateOpen: closeGate.closeGateOpen,
    closeGateIntent: closeGate.closeGateIntent,
    stayAfterCloseAttempt: closeGate.stayAfterCloseAttempt,
    discardUnsavedAndClose: () => {
      void closeGate.discardUnsavedAndClose();
    },
    saveAndClose: () => {
      void closeGate.saveAndClose();
    },
  };
}
