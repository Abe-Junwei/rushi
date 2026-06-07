import { memo } from "react";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  resolveSegmentStageLabels,
  segmentStageChipModifier,
} from "../../services/segmentTextStage";
import { SegmentStageIcon } from "./segmentStageIcon";

type SegmentRowStageBadgeProps = {
  segment: SegmentDto;
  hasUnsavedDraft: boolean;
  compact?: boolean;
};

export const SegmentRowStageBadge = memo(function SegmentRowStageBadge({
  segment,
  hasUnsavedDraft,
  compact = false,
}: SegmentRowStageBadgeProps) {
  const labels = resolveSegmentStageLabels(segment.text_stage, segment.finalize_via);
  const stageMod = segmentStageChipModifier(segment.text_stage);

  return (
    <div
      className="seg-row-stage-badge flex shrink-0 flex-col items-end justify-start gap-1 self-start pt-1.5 pl-1"
      aria-label={labels.tooltip}
      title={labels.tooltip}
    >
      <div className="flex items-center gap-1">
        {hasUnsavedDraft ? (
          <span
            className="seg-row-stage-draft-dot"
            aria-label="有未保存修改"
            title="有未保存修改"
          />
        ) : null}
        <span
          className={[
            "seg-row-stage-chip",
            `seg-row-stage-chip--${stageMod}`,
            compact ? "seg-row-stage-chip--compact" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="seg-row-stage-chip__icon">
            <SegmentStageIcon stage={segment.text_stage} />
          </span>
          {!compact ? (
            <span className="seg-row-stage-chip__label">{labels.category}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
});
