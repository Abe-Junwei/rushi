import { describe, expect, it } from "vitest";
import { resolveSelectSegmentViewportPlan } from "./selectSegmentViewportPlan";

describe("resolveSelectSegmentViewportPlan", () => {
  const seg = { start_sec: 10, end_sec: 12 };

  it("scrolls when auto-fit is off", () => {
    expect(resolveSelectSegmentViewportPlan(false, seg)).toEqual({ kind: "scroll", segment: seg });
  });

  it("fits explicit segment when auto-fit is on", () => {
    expect(resolveSelectSegmentViewportPlan(true, seg)).toEqual({ kind: "fit", segment: seg });
  });
});
