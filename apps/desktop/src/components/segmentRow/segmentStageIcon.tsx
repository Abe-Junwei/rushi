import { PRODUCT_ICON } from "../../config/productIcons";
import { LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import type { SegmentTextStage } from "../../services/segmentTextStage";
import { segmentStageChipModifier } from "../../services/segmentTextStage";
import type { TablerIcon } from "@tabler/icons-react";

const STAGE_ICONS: Record<SegmentTextStage, TablerIcon> = {
  auto_transcribe: PRODUCT_ICON.stageAutoTranscribe,
  ai_revised: PRODUCT_ICON.stageAiRevised,
  manual_transcribe: PRODUCT_ICON.stageManual,
  finalized: PRODUCT_ICON.stageFinalized,
};

type SegmentStageIconProps = {
  stage: SegmentTextStage | undefined | null;
  className?: string;
};

export function SegmentStageIcon({ stage, className }: SegmentStageIconProps) {
  const normalized = segmentStageChipModifier(stage);
  const Icon = STAGE_ICONS[normalized];
  return (
    <Icon className={className} aria-hidden strokeWidth={LUCIDE_ICON_STROKE_WIDTH} />
  );
}
