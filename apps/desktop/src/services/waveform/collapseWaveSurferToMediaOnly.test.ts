import { describe, expect, it, vi } from "vitest";
import {
  buildWaveSurferMediaOnlyStubPeaks,
  collapseWaveSurferToMediaOnly,
} from "./collapseWaveSurferToMediaOnly";

describe("collapseWaveSurferToMediaOnly", () => {
  it("builds a single stub peak column", () => {
    const peaks = buildWaveSurferMediaOnlyStubPeaks();
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toHaveLength(2);
  });

  it("setOptions stub peaks + minPxPerSec 0 + fillParent when duration is ready", () => {
    const setOptions = vi.fn();
    const ws = {
      getDuration: () => 120,
      setOptions,
    };
    expect(collapseWaveSurferToMediaOnly(ws as never)).toBe(true);
    expect(setOptions).toHaveBeenCalledWith({
      peaks: [expect.any(Float32Array)],
      duration: 120,
      minPxPerSec: 0,
      fillParent: true,
    });
  });

  it("no-ops when duration is not ready", () => {
    const setOptions = vi.fn();
    expect(
      collapseWaveSurferToMediaOnly({
        getDuration: () => 0,
        setOptions,
      } as never),
    ).toBe(false);
    expect(setOptions).not.toHaveBeenCalled();
  });

  it("skips setOptions when already collapsed (idempotent)", () => {
    const setOptions = vi.fn();
    expect(
      collapseWaveSurferToMediaOnly({
        getDuration: () => 120,
        options: { minPxPerSec: 0, fillParent: true },
        setOptions,
      } as never),
    ).toBe(false);
    expect(setOptions).not.toHaveBeenCalled();
  });
});
