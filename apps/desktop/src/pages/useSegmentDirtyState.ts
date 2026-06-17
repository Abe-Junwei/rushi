import { useCallback, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  segmentsEqualForPersist,
  segmentsPersistSignature,
  snapshotSegmentsForPersist,
} from "./segmentListHelpers";
import { segmentsWithDraftsApplied } from "../services/segmentDirtyRead";

/** 关闭应用时对话框正文（由 `UnsavedCloseDialog` 展示，勿依赖 `window.confirm`）。 */
export const UNSAVED_CLOSE_DISCARD_PROMPT =
  "关闭后未保存的正文修改将丢失。\n可先保存并退出，或放弃修改后退出。";

/** 离开当前文件/项目时对话框正文。 */
export const UNSAVED_NAV_DISCARD_PROMPT =
  "离开后未保存的正文修改将丢失。\n可先保存再离开，或放弃修改后继续。";

export interface SegmentDirtyStateDeps {
  currentFileId: string | null;
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  flushSegmentTextDrafts: () => void;
}

export interface SegmentDirtyStateApi {
  markSegmentsSaved: () => void;
  /** After reload from DB, align snapshot without reading DOM drafts. */
  setSavedSnapshot: (segments: SegmentDto[]) => void;
  /** Last persisted snapshot (for correction-memory learn baseline). */
  getSavedSnapshot: () => SegmentDto[];
  clearSavedSnapshot: () => void;
  hasUnsavedSegmentChanges: () => boolean;
  confirmDiscardUnsavedIfNeeded: () => boolean;
}

export function useSegmentDirtyState(deps: SegmentDirtyStateDeps): SegmentDirtyStateApi {
  const { currentFileId, getCurrentSegmentsSnapshot, flushSegmentTextDrafts } = deps;
  const savedSegmentsRef = useRef<SegmentDto[]>([]);

  const markSegmentsSaved = useCallback(() => {
    flushSegmentTextDrafts();
    savedSegmentsRef.current = snapshotSegmentsForPersist(getCurrentSegmentsSnapshot());
  }, [flushSegmentTextDrafts, getCurrentSegmentsSnapshot]);

  const setSavedSnapshot = useCallback((segments: SegmentDto[]) => {
    savedSegmentsRef.current = snapshotSegmentsForPersist(segments);
  }, []);

  const getSavedSnapshot = useCallback(
    () => snapshotSegmentsForPersist(savedSegmentsRef.current),
    [],
  );

  const clearSavedSnapshot = useCallback(() => {
    savedSegmentsRef.current = [];
  }, []);

  const hasUnsavedSegmentChanges = useCallback(() => {
    if (!currentFileId) return false;
    const withDrafts = segmentsWithDraftsApplied(getCurrentSegmentsSnapshot());
    const saved = savedSegmentsRef.current;
    if (segmentsPersistSignature(withDrafts) === segmentsPersistSignature(saved)) return false;
    return !segmentsEqualForPersist(withDrafts, saved);
  }, [currentFileId, getCurrentSegmentsSnapshot]);

  const confirmDiscardUnsavedIfNeeded = useCallback(() => {
    return !hasUnsavedSegmentChanges();
  }, [hasUnsavedSegmentChanges]);

  return {
    markSegmentsSaved,
    setSavedSnapshot,
    getSavedSnapshot,
    clearSavedSnapshot,
    hasUnsavedSegmentChanges,
    confirmDiscardUnsavedIfNeeded,
  };
}
