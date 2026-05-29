export type SegmentTimeRange = { start_sec: number; end_sec: number };

export type SelectSegmentViewportPlan = {
  kind: "fit";
  segment: SegmentTimeRange;
};

/** 选中语段后的视口动作：始终适配选中语段到视口。 */
export function resolveSelectSegmentViewportPlan(
  segment: SegmentTimeRange,
): SelectSegmentViewportPlan {
  return { kind: "fit", segment };
}
