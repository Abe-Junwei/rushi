import { describe, expect, it } from "vitest";
import { computePrepareModelProgress, parsePrepareProgressPercent } from "./prepareModelProgress";

describe("parsePrepareProgressPercent", () => {
  it("clamps and rounds server values", () => {
    expect(parsePrepareProgressPercent(42.6)).toBe(43);
    expect(parsePrepareProgressPercent(150)).toBe(99);
    expect(parsePrepareProgressPercent(-3)).toBe(0);
    expect(parsePrepareProgressPercent("x")).toBeNull();
  });
});

describe("computePrepareModelProgress", () => {
  it("ramps recognizer stage from near zero below vad band", () => {
    expect(computePrepareModelProgress("downloading_recognizer", 0)).toBe(2);
    expect(computePrepareModelProgress("downloading_recognizer", 450_000)).toBeGreaterThan(30);
    expect(computePrepareModelProgress("downloading_recognizer", 900_000)).toBe(70);
  });

  it("starts vad stage in high band and caps below done", () => {
    expect(computePrepareModelProgress("downloading_vad", 0)).toBe(72);
    expect(computePrepareModelProgress("downloading_vad", 120_000)).toBe(94);
  });
});
