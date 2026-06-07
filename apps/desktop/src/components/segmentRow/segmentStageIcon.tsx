import { Bot, Check, PenLine, Sparkles, type LucideIcon } from "lucide-react";
import { LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import type { SegmentTextStage } from "../../services/segmentTextStage";
import { segmentStageChipModifier } from "../../services/segmentTextStage";

const STAGE_ICONS: Record<SegmentTextStage, LucideIcon> = {
  auto_transcribe: Bot,
  ai_revised: Sparkles,
  manual_transcribe: PenLine,
  finalized: Check,
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
