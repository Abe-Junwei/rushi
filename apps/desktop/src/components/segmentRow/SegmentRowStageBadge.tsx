import { FileText } from "lucide-react";
import { memo } from "react";
import type { SegmentDto } from "../../tauri/projectApi";
import {
  resolveSegmentStageLabels,
  segmentStageChipModifier,
} from "../../services/segmentTextStage";
import { formatSegmentAnnotationPreview, segmentHasAnnotation } from "../../utils/segmentAnnotation";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { SegmentStageIcon } from "./segmentStageIcon";

type SegmentRowStageBadgeProps = {
  segment: SegmentDto;
  segmentIdx: number;
  hasUnsavedDraft: boolean;
  busy?: boolean;
  compact?: boolean;
  onOpenAnnotation?: (segmentIdx: number) => void;
};

export const SegmentRowStageBadge = memo(function SegmentRowStageBadge({
  segment,
  segmentIdx,
  hasUnsavedDraft,
  busy = false,
  compact = false,
  onOpenAnnotation,
}: SegmentRowStageBadgeProps) {
  const labels = resolveSegmentStageLabels(segment.text_stage, segment.finalize_via);
  const stageMod = segmentStageChipModifier(segment.text_stage);
  const hasAnnotation = segmentHasAnnotation(segment);
  const annotationPreview = hasAnnotation
    ? formatSegmentAnnotationPreview(segment.annotation ?? "")
    : "";

  return (
    <div
      className="seg-row-stage-badge relative flex shrink-0 self-stretch items-center justify-end pl-1"
      aria-label={labels.tooltip}
      title={labels.tooltip}
    >
      {hasAnnotation ? (
        <button
          type="button"
          className="absolute right-0 top-1.5 inline-flex shrink-0 items-center justify-center rounded p-0.5 text-notion-text-muted transition-colors hover:bg-notion-sidebar/70 hover:text-notion-text disabled:opacity-40"
          disabled={busy}
          title={annotationPreview}
          aria-label={`备注：${annotationPreview}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenAnnotation?.(segmentIdx);
          }}
        >
          <FileText className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      ) : null}
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
