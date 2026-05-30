import { describe, expect, it } from "vitest";
import { WAVEFORM_EMBEDDED_TIME_RULER_H_PX } from "../components/WaveformTimeRuler";
import { waveformPeaksBandHeightPx } from "./waveformPeaksStageMetrics";

describe("waveformPeaksBandHeightPx", () => {
  it("subtracts embedded ruler band from tier height", () => {
    expect(waveformPeaksBandHeightPx(220)).toBe(220 - WAVEFORM_EMBEDDED_TIME_RULER_H_PX);
  });

  it("clamps to at least 1px", () => {
    expect(waveformPeaksBandHeightPx(10)).toBe(1);
  });
});
