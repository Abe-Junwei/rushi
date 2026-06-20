import { describe, expect, it } from "vitest";
import {
  clampPrepareProgressPercent,
  computePrepareModelProgress,
  monotonicPrepareProgress,
  parsePrepareProgressPercent,
} from "./prepareModelProgress";

describe("parsePrepareProgressPercent", () => {
  it("clamps and rounds server values", () => {
    expect(parsePrepareProgressPercent(42.6)).toBe(43);
    expect(parsePrepareProgressPercent(150)).toBe(99);
    expect(parsePrepareProgressPercent(-3)).toBe(0);
    expect(parsePrepareProgressPercent("x")).toBeNull();
  });
});

describe("clampPrepareProgressPercent", () => {
  it("caps running jobs below done", () => {
    expect(clampPrepareProgressPercent(100, "running")).toBe(99);
    expect(clampPrepareProgressPercent(100, "done")).toBe(100);
  });
});

describe("monotonicPrepareProgress", () => {
  it("never moves backward during an active job", () => {
    expect(monotonicPrepareProgress(42, 30)).toBe(42);
    expect(monotonicPrepareProgress(42, 55)).toBe(55);
    expect(monotonicPrepareProgress(-1, 12)).toBe(12);
  });
});

describe("computePrepareModelProgress", () => {
  it("ramps recognizer stage from near zero below vad band", () => {
    expect(computePrepareModelProgress("downloading_recognizer", 0)).toBe(2);
    expect(computePrepareModelProgress("downloading_recognizer", 450_000)).toBeGreaterThan(30);
    expect(computePrepareModelProgress("downloading_recognizer", 900_000)).toBe(70);
  });

  it("starts vad stage in high band and caps below punc band", () => {
    expect(computePrepareModelProgress("downloading_vad", 0)).toBe(72);
    expect(computePrepareModelProgress("downloading_vad", 120_000)).toBe(87);
  });

  it("ramps punc stage above vad without falling back to default", () => {
    expect(computePrepareModelProgress("downloading_punc", 0)).toBe(88);
    expect(computePrepareModelProgress("downloading_punc", 180_000)).toBe(98);
    expect(computePrepareModelProgress("downloading_punc", 0)).toBeGreaterThan(
      computePrepareModelProgress("starting", 30_000),
    );
  });
});
