import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  segmentDraftStore,
  subscribeSegmentDraftStore,
} from "../hooks/useSegmentDraftStore";

const AUTO_SAVE_DEBOUNCE_MS = 1500;

export type AutoSaveFooterStatus = "idle" | "pending" | "saving" | "saved";

type Args = {
  enabled: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  busy: boolean;
  saveInFlightRef: MutableRefObject<boolean>;
  hasUnsavedSegmentChanges: () => boolean;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
    explicitPairs?: import("../tauri/fileApi").CorrectionExplicitPair[];
  }) => Promise<boolean>;
  registerClearScheduled?: (clear: () => void) => void;
  registerOnPersisted?: (notify: () => void) => void;
};

export function useAutoSaveSegments(args: Args): { autoSaveFooterStatus: AutoSaveFooterStatus } {
  const {
    enabled,
    currentFileId,
    segments,
    busy,
    saveInFlightRef,
    hasUnsavedSegmentChanges,
    saveSegments,
    registerClearScheduled,
    registerOnPersisted,
  } = args;

  const [autoSaveFooterStatus, setAutoSaveFooterStatus] = useState<AutoSaveFooterStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSegmentsRef = useRef(saveSegments);
  const hasUnsavedRef = useRef(hasUnsavedSegmentChanges);
  const enabledRef = useRef(enabled);
  const currentFileIdRef = useRef(currentFileId);
  const busyRef = useRef(busy);

  saveSegmentsRef.current = saveSegments;
  hasUnsavedRef.current = hasUnsavedSegmentChanges;
  enabledRef.current = enabled;
  currentFileIdRef.current = currentFileId;
  busyRef.current = busy;

  const clearScheduledSave = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const notifyPersisted = useCallback(() => {
    clearScheduledSave();
    setAutoSaveFooterStatus(hasUnsavedRef.current() ? "pending" : "saved");
  }, [clearScheduledSave]);

  useEffect(() => {
    registerClearScheduled?.(clearScheduledSave);
  }, [clearScheduledSave, registerClearScheduled]);

  useEffect(() => {
    registerOnPersisted?.(notifyPersisted);
  }, [notifyPersisted, registerOnPersisted]);

  const scheduleAutoSave = useCallback(() => {
    if (segmentDraftStore.hasActiveComposition()) return;
    if (!enabledRef.current || !currentFileIdRef.current || busyRef.current || saveInFlightRef.current)
      return;
    if (!hasUnsavedRef.current()) {
      setAutoSaveFooterStatus("saved");
      return;
    }
    clearScheduledSave();
    setAutoSaveFooterStatus("pending");
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (!enabledRef.current || !currentFileIdRef.current || busyRef.current || saveInFlightRef.current)
        return;
      if (!hasUnsavedRef.current()) {
        setAutoSaveFooterStatus("saved");
        return;
      }
      setAutoSaveFooterStatus("saving");
      void saveSegmentsRef.current({ quiet: true, countHits: true });
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [clearScheduledSave, saveInFlightRef]);

  useEffect(() => {
    if (busy) {
      clearScheduledSave();
      return;
    }
    if (!enabled || !currentFileId) {
      clearScheduledSave();
      setAutoSaveFooterStatus("idle");
      return;
    }
    if (!hasUnsavedSegmentChanges()) {
      setAutoSaveFooterStatus("saved");
      return;
    }
    scheduleAutoSave();
  }, [busy, clearScheduledSave, currentFileId, enabled, hasUnsavedSegmentChanges, scheduleAutoSave]);

  useEffect(() => {
    if (!enabled || !currentFileId) return;
    scheduleAutoSave();
  }, [currentFileId, enabled, scheduleAutoSave, segments]);

  useEffect(() => {
    if (!enabled || !currentFileId) return;
    return subscribeSegmentDraftStore(() => scheduleAutoSave());
  }, [currentFileId, enabled, scheduleAutoSave]);

  useEffect(() => () => clearScheduledSave(), [clearScheduledSave]);

  return { autoSaveFooterStatus };
}

export function autoSaveFooterLabel(status: AutoSaveFooterStatus): string {
  switch (status) {
    case "pending":
      return "即将自动保存…";
    case "saving":
      return "正在自动保存…";
    case "saved":
      return "已自动保存";
    default:
      return "自动保存仅落库；⌘/Ctrl+Enter 确认改词并记入纠错记忆";
  }
}
