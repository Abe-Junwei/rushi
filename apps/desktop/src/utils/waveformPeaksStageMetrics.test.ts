import { describe, expect, it } from "vitest";
import { WAVEFORM_EMBEDDED_RULER_HEIGHT_PX } from "../services/waveform/drawWaveformTimeRuler";
import { waveformPeaksBandHeightPx } from "./waveformPeaksStageMetrics";

describe("waveformPeaksBandHeightPx", () => {
  it("subtracts embedded ruler band from tier height", () => {
    expect(waveformPeaksBandHeightPx(220)).toBe(220 - WAVEFORM_EMBEDDED_RULER_HEIGHT_PX);
  });

  it("clamps to at least 1px", () => {
    expect(waveformPeaksBandHeightPx(10)).toBe(1);
  });
});
