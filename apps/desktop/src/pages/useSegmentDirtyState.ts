import { useCallback, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  segmentsEqualForPersist,
  snapshotSegmentsForPersist,
} from "./segmentListHelpers";

export const UNSAVED_SEGMENTS_CONFIRM =
  "当前文件有未保存的语段修改，确定放弃吗？";

export interface SegmentDirtyStateDeps {
  currentFileId: string | null;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDraftsFromDom: () => void;
}

export interface SegmentDirtyStateApi {
  markSegmentsSaved: () => void;
  /** After reload from DB, align snapshot without reading DOM drafts. */
  setSavedSnapshot: (segments: SegmentDto[]) => void;
  clearSavedSnapshot: () => void;
  hasUnsavedSegmentChanges: () => boolean;
  confirmDiscardUnsavedIfNeeded: () => boolean;
}

export function useSegmentDirtyState(deps: SegmentDirtyStateDeps): SegmentDirtyStateApi {
  const { currentFileId, segmentsRef, flushSegmentTextDraftsFromDom } = deps;
  const savedSegmentsRef = useRef<SegmentDto[]>([]);

  const markSegmentsSaved = useCallback(() => {
    flushSegmentTextDraftsFromDom();
    savedSegmentsRef.current = snapshotSegmentsForPersist(segmentsRef.current);
  }, [flushSegmentTextDraftsFromDom, segmentsRef]);

  const setSavedSnapshot = useCallback((segments: SegmentDto[]) => {
    savedSegmentsRef.current = snapshotSegmentsForPersist(segments);
  }, []);

  const clearSavedSnapshot = useCallback(() => {
    savedSegmentsRef.current = [];
  }, []);

  const hasUnsavedSegmentChanges = useCallback(() => {
    if (!currentFileId) return false;
    flushSegmentTextDraftsFromDom();
    return !segmentsEqualForPersist(segmentsRef.current, savedSegmentsRef.current);
  }, [currentFileId, flushSegmentTextDraftsFromDom, segmentsRef]);

  const confirmDiscardUnsavedIfNeeded = useCallback(() => {
    if (!hasUnsavedSegmentChanges()) return true;
    return window.confirm(UNSAVED_SEGMENTS_CONFIRM);
  }, [hasUnsavedSegmentChanges]);

  return {
    markSegmentsSaved,
    setSavedSnapshot,
    clearSavedSnapshot,
    hasUnsavedSegmentChanges,
    confirmDiscardUnsavedIfNeeded,
  };
}
