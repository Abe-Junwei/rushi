import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import {
  findSegmentIndexByUid,
  normalizeSegmentList,
} from "./segmentListHelpers";
import {
  segmentHasUnsavedText,
  segmentCanFinalize,
} from "../services/segmentConfirmEligible";
import { waitForSaveIdle } from "../services/waitForSaveIdle";
import { publishSegmentStructureMutation } from "./flushSegmentTextDrafts";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { toast } from "../services/ui/toast";
import type { BusyReason } from "./useProjectCrudController";
import {
  runProjectSavePersistPipeline,
  type SavePersistPipelineOptions,
} from "./projectSavePersistPipeline";

type SegmentDirtyApi = {
  getSavedSnapshot: () => SegmentDto[];
  hasUnsavedSegmentChanges: () => boolean;
  setSavedSnapshot: (segments: SegmentDto[]) => void;
};

type MutationsApi = {
  flushSegmentTextDrafts: () => void;
  resetMutationHistory: () => void;
};

type Args = {
  busy: boolean;
  current: ProjectDetail | null;
  currentFileId: string | null;
  segmentsRef: MutableRefObject<SegmentDto[]>;
  selectedIdxRef: MutableRefObject<number>;
  setCurrent: Dispatch<SetStateAction<ProjectDetail | null>>;
  setSegments: Dispatch<SetStateAction<SegmentDto[]>>;
  setSelectedIdx: Dispatch<SetStateAction<number>>;
  setError: (msg: string) => void;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  mutations: MutationsApi;
  dirty: SegmentDirtyApi;
  pendingAiRevisedUidsRef: MutableRefObject<Set<string>>;
  checkGlossaryLearnAfterSave: () => void;
};

export function useProjectSaveController(args: Args) {
  const {
    busy,
    current,
    currentFileId,
    segmentsRef,
    selectedIdxRef,
    setCurrent,
    setSegments,
    setSelectedIdx,
    setError,
    beginBusy,
    endBusy,
    mutations,
    dirty,
    pendingAiRevisedUidsRef,
    checkGlossaryLearnAfterSave,
  } = args;

  const saveInFlightRef = useRef(false);
  const clearAutoSaveRef = useRef<() => void>(() => {});
  const notifySegmentsPersistedRef = useRef<() => void>(() => {});

  const saveSegments = useCallback(
    async (options?: SavePersistPipelineOptions): Promise<boolean> => {
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
        const { snapshotBase } = await runProjectSavePersistPipeline({
          current,
          currentFileId,
          segmentsRef,
          selectedIdxRef,
          savedSnapshot: dirty.getSavedSnapshot(),
          pendingAiRevisedUids: pendingAiRevisedUidsRef.current,
          setCurrent,
          setSegments,
          setSelectedIdx,
          options,
        });
        dirty.setSavedSnapshot(snapshotBase);
        notifySegmentsPersistedRef.current();
        if (!options?.quiet) {
          toast.success("保存成功");
        }
        void checkGlossaryLearnAfterSave();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [
      busy,
      checkGlossaryLearnAfterSave,
      current,
      currentFileId,
      dirty,
      mutations,
      pendingAiRevisedUidsRef,
      segmentsRef,
      selectedIdxRef,
      setCurrent,
      setError,
      setSegments,
      setSelectedIdx,
    ],
  );

  const finalizeSegmentAt = useCallback(
    async (segmentIdx: number, advance: boolean): Promise<boolean> => {
      if (!current || !currentFileId || busy) return false;
      if (segmentIdx < 0 || segmentIdx >= segmentsRef.current.length) return false;
      if (!segmentCanFinalize(segmentsRef.current, segmentIdx, busy)) return false;
      clearAutoSaveRef.current();
      const hadUnsaved = segmentHasUnsavedText(
        segmentsRef.current,
        dirty.getSavedSnapshot(),
        segmentIdx,
      );
      if (saveInFlightRef.current) {
        const idle = await waitForSaveIdle(saveInFlightRef);
        if (!idle) {
          toast.warning("保存语段失败：自动保存耗时过长，请稍候再试");
          return false;
        }
      }
      const finalizeSaveOptions = {
        quiet: true,
        countHits: hadUnsaved,
        finalizeIntent: { segmentIdx, hadUnsavedDraft: hadUnsaved },
      } as const;
      let saved = await saveSegments(finalizeSaveOptions);
      if (!saved && saveInFlightRef.current) {
        const idle = await waitForSaveIdle(saveInFlightRef);
        if (idle) {
          saved = await saveSegments(finalizeSaveOptions);
        }
      }
      if (!saved) {
        toast.warning("定稿失败：请稍候再试（可能正在自动保存）");
        return false;
      }
      if (advance) {
        const nextIdx = Math.min(segmentIdx + 1, segmentsRef.current.length - 1);
        if (nextIdx !== selectedIdxRef.current) {
          setSelectedIdx(nextIdx);
        }
      }
      return true;
    },
    [
      busy,
      current,
      currentFileId,
      dirty,
      saveSegments,
      segmentsRef,
      selectedIdxRef,
      setSelectedIdx,
    ],
  );

  const confirmSegmentEditAndAdvance = useCallback(
    async (segmentIdx: number): Promise<boolean> => finalizeSegmentAt(segmentIdx, true),
    [finalizeSegmentAt],
  );

  const markSegmentFinalized = useCallback(
    async (segmentIdx: number): Promise<boolean> => finalizeSegmentAt(segmentIdx, false),
    [finalizeSegmentAt],
  );

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
        publishSegmentStructureMutation(segmentsRef, setSegments, segs);
        const ni = findSegmentIndexByUid(segs, prevUid);
        setSelectedIdx(
          ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1)),
        );
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
      beginBusy,
      busy,
      currentFileId,
      dirty,
      endBusy,
      mutations,
      segmentsRef,
      selectedIdxRef,
      setError,
      setSegments,
      setSelectedIdx,
    ],
  );

  return {
    saveInFlightRef,
    clearAutoSaveRef,
    notifySegmentsPersistedRef,
    saveSegments,
    confirmSegmentEditAndAdvance,
    markSegmentFinalized,
    restoreEditorFromEditLog,
  };
}
