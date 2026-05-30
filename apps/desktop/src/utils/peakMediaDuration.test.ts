import { describe, expect, it } from "vitest";
import {
  peaksEnsureMediaDurationSec,
  peaksMediaDurationMismatch,
  shouldForcePeaksRegenerate,
} from "./peakMediaDuration";

describe("peaksMediaDurationMismatch", () => {
  it("flags when peaks cover less than 98% of media", () => {
    expect(peaksMediaDurationMismatch(732, 1195)).toBe(true);
    expect(peaksMediaDurationMismatch(1180, 1195)).toBe(false);
  });

  it("returns false when either duration is unknown", () => {
    expect(peaksMediaDurationMismatch(0, 1195)).toBe(false);
    expect(peaksMediaDurationMismatch(732, 0)).toBe(false);
  });
});

describe("peaksEnsureMediaDurationSec", () => {
  it("returns undefined until media duration is known", () => {
    expect(peaksEnsureMediaDurationSec(0)).toBeUndefined();
    expect(peaksEnsureMediaDurationSec(1195)).toBe(1195);
  });
});

describe("shouldForcePeaksRegenerate", () => {
  it("skips force on long media when peaks cover at least 95%", () => {
    expect(shouldForcePeaksRegenerate(13_800, 14_400)).toBe(false);
  });

  it("still forces when long media peaks are genuinely short", () => {
    expect(shouldForcePeaksRegenerate(12_000, 14_400)).toBe(true);
  });

  it("forces on short media below coverage ratio", () => {
    expect(shouldForcePeaksRegenerate(732, 1195)).toBe(true);
  });
});
