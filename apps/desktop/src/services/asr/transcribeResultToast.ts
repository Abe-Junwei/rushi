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
  return resolveTranscribeResultPresentation(params).summary;
}

export type TranscribeResultPresentation = {
  summary: string;
  variant: "success" | "warning";
  showDeliveryModeAction: boolean;
};

/** 无语段或全文为空时不展示「转写完成」成功态。 */
export function resolveTranscribeResultPresentation(params: {
  segmentCount: number;
  charCount: number;
  elapsedMs: number;
}): TranscribeResultPresentation {
  const { segmentCount, charCount, elapsedMs } = params;
  const elapsed = formatTranscribeElapsedLabel(elapsedMs);
  const usable = segmentCount > 0 && charCount > 0;
  if (!usable) {
    const detail =
      segmentCount === 0
        ? "未生成语段"
        : "语段正文均为空";
    return {
      summary: `转写结束：${detail}（用时 ${elapsed}）`,
      variant: "warning",
      showDeliveryModeAction: false,
    };
  }
  const chars = charCount.toLocaleString("zh-CN");
  return {
    summary: `转写完成：用时 ${elapsed}，${segmentCount} 条语段，${chars} 字`,
    variant: "success",
    showDeliveryModeAction: true,
  };
}
