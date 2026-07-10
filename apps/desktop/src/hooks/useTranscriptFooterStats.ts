import { useMemo } from "react";
import { countTranscribeCharacters } from "../services/asr/transcribeResultToast";
import type { SegmentDto } from "../tauri/projectApi";

/** 页脚语段/字数：直接读 SegmentDto[]（CM6 投影）。 */
export function useTranscriptFooterStats(segments: SegmentDto[]): {
  segmentCount: number;
  charCount: number;
} {
  const charCount = useMemo(() => countTranscribeCharacters(segments), [segments]);
  return { segmentCount: segments.length, charCount };
}

/** @internal vitest only — no module throttle state after P9b2b. */
export function resetTranscriptFooterStatsForTests(): void {}
