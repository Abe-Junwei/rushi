import { useCallback, useRef } from "react";
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
import { pushEditHistoryRestoreActivity } from "../services/ui/pushActivity";
import { toast } from "../services/ui/toast";
import type { BusyReason } from "./useProjectCrudController";
import type { SegmentPublishApi } from "./segmentPublishApi";
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
  segmentPublish: SegmentPublishApi;
  selectedIdxRef: React.MutableRefObject<number>;
  setCurrent: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  setSelectedIdx: (idx: number) => void;
  setError: (msg: string) => void;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  mutations: MutationsApi;
  dirty: SegmentDirtyApi;
  pendingAiRevisedUidsRef: React.MutableRefObject<Set<string>>;
};

export function useProjectSaveController(args: Args) {
  const {
    busy,
    current,
    currentFileId,
    segmentPublish,
    selectedIdxRef,
    setCurrent,
    setSelectedIdx,
    setError,
    beginBusy,
    endBusy,
    mutations,
    dirty,
    pendingAiRevisedUidsRef,
  } = args;

  const saveInFlightRef = useRef(false);
  const clearAutoSaveRef = useRef<() => void>(() => {});
  const notifySegmentsPersistedRef = useRef<() => void>(() => {});
  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;

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
          segmentPublish,
          selectedIdxRef,
          savedSnapshot: dirty.getSavedSnapshot(),
          pendingAiRevisedUids: pendingAiRevisedUidsRef.current,
          setCurrent,
          setSelectedIdx,
          options,
        });
        dirty.setSavedSnapshot(snapshotBase);
        notifySegmentsPersistedRef.current();
        if (!options?.quiet) {
          toast.success("保存成功");
        }
        // 「加入术语表？」仅由「纳入更正记忆」触发，不在语段保存后扫全局 backlog。
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
      current,
      currentFileId,
      dirty,
      mutations,
      pendingAiRevisedUidsRef,
      segmentPublish,
      selectedIdxRef,
      setCurrent,
      setError,
      setSelectedIdx,
    ],
  );

  const finalizeSegmentAt = useCallback(
    async (segmentIdx: number): Promise<boolean> => {
      if (!current || !currentFileId || busy) return false;
      const currentSegments = getCurrentSegmentsSnapshot();
      if (segmentIdx < 0 || segmentIdx >= currentSegments.length) return false;
      const stage = currentSegments[segmentIdx]?.text_stage ?? "auto_transcribe";
      if (stage === "finalized") return true;
      if (!segmentCanFinalize(currentSegments, segmentIdx, busy)) return false;
      clearAutoSaveRef.current();
      const hadUnsaved = segmentHasUnsavedText(
        currentSegments,
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
      return true;
    },
    [
      busy,
      current,
      currentFileId,
      dirty,
      getCurrentSegmentsSnapshot,
      saveSegments,
    ],
  );

  const confirmSegmentEditAndAdvance = useCallback(
    async (segmentIdx: number): Promise<boolean> => finalizeSegmentAt(segmentIdx),
    [finalizeSegmentAt],
  );

  const markSegmentFinalized = useCallback(
    async (segmentIdx: number): Promise<boolean> => finalizeSegmentAt(segmentIdx),
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
        await p1.fileRestoreSegmentsFromEditLog(currentFileId, editLogId);
        const fd = await fileApi.loadFile(currentFileId);
        const prevUid = getCurrentSegmentsSnapshot()[selectedIdxRef.current]?.uid;
        const segs = normalizeSegmentList(fd.segments);
        segmentPublish.publishStructure(segs);
        const ni = findSegmentIndexByUid(segs, prevUid);
        setSelectedIdx(
          ni >= 0 ? ni : Math.min(selectedIdxRef.current, Math.max(0, segs.length - 1)),
        );
        dirty.setSavedSnapshot(segs);
        notifySegmentsPersistedRef.current();
        if (current?.id) {
          const fileLabel =
            current.files?.find((file) => file.id === currentFileId)?.name?.trim() || current.name;
          pushEditHistoryRestoreActivity({
            projectId: current.id,
            fileId: currentFileId,
            fileLabel,
          });
        } else {
          toast.success("已恢复到所选版本");
        }
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
      current,
      currentFileId,
      dirty,
      endBusy,
      mutations,
      getCurrentSegmentsSnapshot,
      segmentPublish,
      selectedIdxRef,
      setError,
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
