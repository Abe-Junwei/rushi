import { describe, expect, it } from "vitest";
import {
  defaultWaveformRulerCanvasPalette,
  readWaveformRulerCanvasPalette,
} from "./waveformRulerCanvasColors";

describe("waveformRulerCanvasColors", () => {
  it("returns default palette with notion text fallback", () => {
    const palette = defaultWaveformRulerCanvasPalette();
    expect(palette.minorTick).toBeTruthy();
    expect(palette.majorTick).toBeTruthy();
    expect(palette.label).toBeTruthy();
    expect(palette.labelActive).toBeTruthy();
  });

  it("passes through explicit palette in readWaveformRulerCanvasPalette", () => {
    const custom = {
      minorTick: "a",
      majorTick: "b",
      label: "c",
      labelActive: "d",
    };
    expect(readWaveformRulerCanvasPalette(custom)).toBe(custom);
  });
});
