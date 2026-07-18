import { describe, expect, it } from "vitest";
import {
  estimateTranscribeRemainingSecs,
  formatApproxRemainingMinutes,
  transcribeDeterminateFraction,
} from "./estimateTranscribeRemainingSecs";

describe("transcribeDeterminateFraction", () => {
  it("returns null for single-window / invalid", () => {
    expect(transcribeDeterminateFraction(1, 1)).toBeNull();
    expect(transcribeDeterminateFraction(0, 0)).toBeNull();
  });

  it("maps i/n to 0–1", () => {
    expect(transcribeDeterminateFraction(2, 5)).toBeCloseTo(0.4);
    expect(transcribeDeterminateFraction(5, 5)).toBe(1);
  });
});

describe("estimateTranscribeRemainingSecs", () => {
  it("waits until warm-up (completed window or p≥threshold)", () => {
    expect(
      estimateTranscribeRemainingSecs({
        windowIndex: 1,
        windowCount: 100,
        elapsedSec: 30,
      }),
    ).toBeNull();
  });

  it("estimates after warm-up", () => {
    const remaining = estimateTranscribeRemainingSecs({
      windowIndex: 2,
      windowCount: 4,
      elapsedSec: 100,
    });
    expect(remaining).toBeCloseTo(100); // (1-0.5)/0.5 * 100
  });

  it("never invents ETA for single window", () => {
    expect(
      estimateTranscribeRemainingSecs({
        windowIndex: 1,
        windowCount: 1,
        elapsedSec: 500,
      }),
    ).toBeNull();
  });
});

describe("formatApproxRemainingMinutes", () => {
  it("formats a coarse band", () => {
    expect(formatApproxRemainingMinutes(180)).toMatch(/约剩余/);
    expect(formatApproxRemainingMinutes(null)).toBeNull();
  });
});
