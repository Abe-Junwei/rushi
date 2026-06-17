import { describe, expect, it, vi } from "vitest";
import { computeTimelineWidthPx, MAX_WAVESURFER_PEAK_COLUMNS } from "../../utils/pxPerSec";
import { resampleWaveformForPxPerSec } from "./audiowaveformDat";

function mockWaveformData(durationSec: number, length: number) {
  const resample = vi.fn(({ width }: { width: number }) => ({
    duration: durationSec,
    length: width,
    resample,
  }));
  return { duration: durationSec, length, resample };
}

describe("resampleWaveformForPxPerSec", () => {
  it("targets computeTimelineWidthPx for resample width", () => {
    const data = mockWaveformData(600, 1200);
    const pxPerSec = 0.05;
    const expectedWidth = computeTimelineWidthPx(600, pxPerSec);

    resampleWaveformForPxPerSec(data as never, pxPerSec);

    expect(expectedWidth).toBe(30);
    expect(data.resample).toHaveBeenCalledWith({ width: 30 });
  });

  it("returns base data unchanged when target exceeds base width (no upsample)", () => {
    const data = mockWaveformData(10, 100);
    const out = resampleWaveformForPxPerSec(data as never, 56);
    expect(out).toBe(data);
    expect(data.resample).not.toHaveBeenCalled();
  });

  it("caps resample width for very long timelines", () => {
    const data = mockWaveformData(14_400, 2_880_000);
    resampleWaveformForPxPerSec(data as never, 107, 14_400);
    expect(data.resample).toHaveBeenCalledWith({ width: MAX_WAVESURFER_PEAK_COLUMNS });
  });
});
