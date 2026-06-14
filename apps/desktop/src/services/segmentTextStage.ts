/** 语段正文编辑阶段（SQLite `segments.text_stage` 真源）。 */
export type SegmentTextStage =
  | "auto_transcribe"
  | "ai_revised"
  | "manual_transcribe"
  | "finalized";

export type SegmentFinalizeVia = "confirm_edit" | "mark_only";

export const DEFAULT_SEGMENT_TEXT_STAGE: SegmentTextStage = "auto_transcribe";

export type SegmentStageLabels = {
  category: string;
  tooltip: string;
};

const STAGE_LABELS: Record<Exclude<SegmentTextStage, "finalized">, SegmentStageLabels> = {
  auto_transcribe: {
    category: "自动转写",
    tooltip: "自动转写，待改稿",
  },
  ai_revised: {
    category: "AI改稿",
    tooltip: "AI 改稿已写回，待改稿或定稿",
  },
  manual_transcribe: {
    category: "手动转写",
    tooltip: "手动转写，已保存，待确认定稿",
  },
};

const FINALIZED_TOOLTIPS: Record<SegmentFinalizeVia, string> = {
  confirm_edit: "已定稿（已确认改词）",
  mark_only: "已定稿（已标记认可）",
};

export function normalizeSegmentTextStage(raw: unknown): SegmentTextStage {
  if (
    raw === "auto_transcribe" ||
    raw === "ai_revised" ||
    raw === "manual_transcribe" ||
    raw === "finalized"
  ) {
    return raw;
  }
  return DEFAULT_SEGMENT_TEXT_STAGE;
}

export function normalizeSegmentFinalizeVia(raw: unknown): SegmentFinalizeVia | null {
  if (raw === "confirm_edit" || raw === "mark_only") return raw;
  return null;
}

export function resolveSegmentStageLabels(
  stage: SegmentTextStage | undefined | null,
  finalizeVia: SegmentFinalizeVia | null | undefined,
): SegmentStageLabels {
  const normalized = normalizeSegmentTextStage(stage);
  if (normalized === "finalized") {
    const via = finalizeVia === "confirm_edit" ? "confirm_edit" : "mark_only";
    return {
      category: "定稿",
      tooltip: FINALIZED_TOOLTIPS[via],
    };
  }
  return STAGE_LABELS[normalized];
}

/** 语段行 stage 芯片 CSS 修饰符（`seg-row-stage-chip--*`）。 */
export function segmentStageChipModifier(
  stage: SegmentTextStage | undefined | null,
): SegmentTextStage {
  return normalizeSegmentTextStage(stage);
}

const SEGMENT_STAGE_CERTAINTY_RANK: Record<SegmentTextStage, number> = {
  auto_transcribe: 0,
  ai_revised: 1,
  manual_transcribe: 2,
  finalized: 3,
};

/** 合并语段时取确信度较低（更未确认）的阶段。 */
export function leastConfirmedSegmentStage(
  a: SegmentTextStage | undefined | null,
  b: SegmentTextStage | undefined | null,
): SegmentTextStage {
  const na = normalizeSegmentTextStage(a);
  const nb = normalizeSegmentTextStage(b);
  return SEGMENT_STAGE_CERTAINTY_RANK[na] <= SEGMENT_STAGE_CERTAINTY_RANK[nb] ? na : nb;
}

export function withDefaultSegmentStage<T extends { text_stage?: SegmentTextStage | null }>(
  seg: T,
): T & { text_stage: SegmentTextStage; finalize_via: SegmentFinalizeVia | null } {
  return {
    ...seg,
    text_stage: normalizeSegmentTextStage(seg.text_stage),
    finalize_via: normalizeSegmentFinalizeVia(
      (seg as { finalize_via?: unknown }).finalize_via,
    ),
  };
}

export function newSegmentWithDefaultStage<T extends object>(seg: T): T & {
  text_stage: SegmentTextStage;
  finalize_via: null;
} {
  return {
    ...seg,
    text_stage: DEFAULT_SEGMENT_TEXT_STAGE,
    finalize_via: null,
  };
}

/** 用户手建语段（插入空段 / 选区新建）：默认手转，非 ASR 自转。 */
export function newUserCreatedSegment<T extends object>(seg: T): T & {
  text_stage: SegmentTextStage;
  finalize_via: null;
} {
  return {
    ...seg,
    text_stage: "manual_transcribe",
    finalize_via: null,
  };
}
