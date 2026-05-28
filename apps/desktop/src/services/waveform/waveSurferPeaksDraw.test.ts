import { describe, expect, it, vi } from "vitest";
import { applyWaveSurferPeaksDrawMode, WAVEFORM_WS_TRANSPARENT_DRAW } from "./waveSurferPeaksDraw";

describe("applyWaveSurferPeaksDrawMode", () => {
  it("sets transparent colors when canvas peaks are active", () => {
    const setOptions = vi.fn();
    const ws = { setOptions } as never;
    applyWaveSurferPeaksDrawMode(ws, true);
    expect(setOptions).toHaveBeenCalledWith(WAVEFORM_WS_TRANSPARENT_DRAW);
  });
});
