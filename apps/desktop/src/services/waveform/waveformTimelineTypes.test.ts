import { describe, expect, it } from "vitest";
import type { ViewportFitPhase } from "./waveformTimelineTypes";

describe("waveformTimelineTypes", () => {
  it("exports viewport fit phases", () => {
    const phase: ViewportFitPhase = "idle";
    expect(phase).toBe("idle");
  });
});
