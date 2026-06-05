import { useCallback, useSyncExternalStore } from "react";
import { countTranscribeCharacters } from "../services/asr/transcribeResultToast";
import { segmentsWithDraftsApplied } from "../services/segmentDirtyRead";
import { subscribeSegmentDraftStore } from "./useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";

/** 页脚语段/字数：叠入未 flush 草稿，随输入即时更新（不等待自动保存）。 */
export function useTranscriptFooterStats(segments: SegmentDto[]): {
  segmentCount: number;
  charCount: number;
} {
  const getCharCount = useCallback(
    () => countTranscribeCharacters(segmentsWithDraftsApplied(segments)),
    [segments],
  );
  const charCount = useSyncExternalStore(subscribeSegmentDraftStore, getCharCount, getCharCount);
  return { segmentCount: segments.length, charCount };
}
