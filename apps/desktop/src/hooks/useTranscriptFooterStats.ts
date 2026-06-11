import { useCallback, useSyncExternalStore } from "react";
import { countTranscribeCharacters } from "../services/asr/transcribeResultToast";
import { segmentsWithDraftsApplied } from "../services/segmentDirtyRead";
import { subscribeSegmentDraftStore } from "./useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";

/** Throttle footer char recounts during fast typing (SEG-TEXT-P0d). */
export const TRANSCRIPT_FOOTER_STATS_THROTTLE_MS = 100;

let footerNotifySeq = 0;
let footerThrottleTimer: ReturnType<typeof setTimeout> | null = null;
const footerListeners = new Set<() => void>();

function notifyFooterListeners(): void {
  footerNotifySeq += 1;
  footerListeners.forEach((l) => l());
}

function scheduleFooterNotify(): void {
  if (footerThrottleTimer != null) {
    clearTimeout(footerThrottleTimer);
  }
  footerThrottleTimer = setTimeout(() => {
    footerThrottleTimer = null;
    notifyFooterListeners();
  }, TRANSCRIPT_FOOTER_STATS_THROTTLE_MS);
}

/** @internal vitest only — clears module throttle state between tests. */
export function resetTranscriptFooterStatsForTests(): void {
  if (footerThrottleTimer != null) {
    clearTimeout(footerThrottleTimer);
    footerThrottleTimer = null;
  }
  footerNotifySeq = 0;
  footerListeners.clear();
}

function subscribeTranscriptFooterStats(listener: () => void): () => void {
  footerListeners.add(listener);
  const onDraftChange = () => scheduleFooterNotify();
  const unsubDraft = subscribeSegmentDraftStore(onDraftChange);
  return () => {
    footerListeners.delete(listener);
    unsubDraft();
    if (footerListeners.size === 0 && footerThrottleTimer != null) {
      clearTimeout(footerThrottleTimer);
      footerThrottleTimer = null;
    }
  };
}

function getFooterStatsSnapshot(): number {
  return footerNotifySeq;
}

/** 页脚语段/字数：叠入未 flush 草稿；输入时节流，最终与草稿一致。 */
export function useTranscriptFooterStats(segments: SegmentDto[]): {
  segmentCount: number;
  charCount: number;
} {
  const getCharCount = useCallback(
    () => countTranscribeCharacters(segmentsWithDraftsApplied(segments)),
    [segments],
  );
  const getSnapshot = useCallback(() => {
    getFooterStatsSnapshot();
    return getCharCount();
  }, [getCharCount]);
  const charCount = useSyncExternalStore(subscribeTranscriptFooterStats, getSnapshot, getSnapshot);
  return { segmentCount: segments.length, charCount };
}
