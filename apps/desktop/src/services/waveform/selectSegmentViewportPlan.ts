export type SegmentTimeRange = { start_sec: number; end_sec: number };

export type SelectSegmentViewportPlan =
  | { kind: "scroll"; segment: SegmentTimeRange }
  | { kind: "fit"; segment: SegmentTimeRange };

/** 选中语段后的视口动作（纯函数，便于单测与编排层共用）。 */
export function resolveSelectSegmentViewportPlan(
  autoFitSelectionToViewport: boolean,
  segment: SegmentTimeRange,
): SelectSegmentViewportPlan {
  return autoFitSelectionToViewport
    ? { kind: "fit", segment }
    : { kind: "scroll", segment };
}
