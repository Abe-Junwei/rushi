import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { flushSync } from "react-dom";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import * as fileApi from "../tauri/fileApi";
import {
  findSegmentIndexByUid,
  normalizeSegmentList,
  prepareSegmentsForPersist,
  segmentsEqualForPersist,
} from "./segmentListHelpers";
import { segmentsToLearnBaselineAligned } from "../services/correctionLearnBaseline";
import { waitForSaveIdle } from "../services/waitForSaveIdle";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { toast } from "../services/ui/toast";
import type { BusyReason } from "./useProjectCrudController";

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
    checkGlossaryLearnAfterSave,
  } = args;

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
        const countHits = options?.countHits ?? true;
        const learnBaselineTexts = countHits
          ? (options?.learnBaselineTexts ??
              segmentsToLearnBaselineAligned(
                dirty.getSavedSnapshot(),
                segmentsRef.current,
              ))
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
      segmentsRef,
      selectedIdxRef,
      setCurrent,
      setError,
      setSegments,
      setSelectedIdx,
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
    restoreEditorFromEditLog,
  };
}
