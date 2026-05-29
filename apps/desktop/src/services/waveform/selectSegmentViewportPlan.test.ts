import { describe, expect, it } from "vitest";
import { resolveSelectSegmentViewportPlan } from "./selectSegmentViewportPlan";

describe("resolveSelectSegmentViewportPlan", () => {
  const seg = { start_sec: 10, end_sec: 12 };

  it("always fits the selected segment to the viewport", () => {
    expect(resolveSelectSegmentViewportPlan(seg)).toEqual({ kind: "fit", segment: seg });
  });
});
