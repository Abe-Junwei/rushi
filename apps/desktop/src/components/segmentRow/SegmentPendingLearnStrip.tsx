import { memo } from "react";
import type { CorrectionExplicitPair } from "../../tauri/fileApi";

type Props = {
  learnablePairs: CorrectionExplicitPair[];
  isComposing: boolean;
};

function formatPair(beforeText: string, afterText: string): string {
  return `「${beforeText}」→「${afterText}」`;
}

/** 语段行右侧：与「纳入记忆」同行的改词摘要（无标题、无底色）。 */
export const SegmentPendingLearnStrip = memo(function SegmentPendingLearnStrip({
  learnablePairs,
  isComposing,
}: Props) {
  if (isComposing) {
    return (
      <span className="whitespace-nowrap text-[11px] text-notion-text-muted" aria-live="polite">
        输入中…
      </span>
    );
  }
  if (learnablePairs.length === 0) return null;

  const label = learnablePairs.map((pair) => formatPair(pair.beforeText, pair.afterText)).join(" ");
  return (
    <span className="text-[11px] leading-snug text-notion-text whitespace-nowrap">{label}</span>
  );
});
