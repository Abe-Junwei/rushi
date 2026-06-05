/** 转写完成 toast：仅汇报用时、语段数、字符数。 */

import type { SegmentLike } from "../asrTranscribeHints";
import { countTranscriptBodyCharacters } from "../text/transcriptCharCount";

export function formatTranscribeElapsedLabel(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.round(elapsedMs / 1000));
  if (totalSec < 60) return `${totalSec} 秒`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min} 分 ${sec} 秒` : `${min} 分钟`;
}

/** 全稿字数（不含标点），用于 toast / 页脚统计。 */
export function countTranscribeCharacters(segments: SegmentLike[]): number {
  return segments.reduce(
    (total, segment) => total + countTranscriptBodyCharacters(segment.text ?? ""),
    0,
  );
}

export function buildTranscribeResultSummary(params: {
  segmentCount: number;
  charCount: number;
  elapsedMs: number;
}): string {
  const { segmentCount, charCount, elapsedMs } = params;
  const elapsed = formatTranscribeElapsedLabel(elapsedMs);
  const chars = charCount.toLocaleString("zh-CN");
  return `转写完成：用时 ${elapsed}，${segmentCount} 条语段，${chars} 字`;
}
