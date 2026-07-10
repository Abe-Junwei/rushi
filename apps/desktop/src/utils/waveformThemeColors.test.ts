import { afterEach, describe, expect, it } from "vitest";
import { COLORS } from "../config/tokens";
import { SEGMENT_FILL_CSS_VAR } from "../config/segmentFillTokens";
import {
  invalidateWaveformSegmentBandPaletteCache,
  readCssColorVar,
  readWaveformSegmentBandPalette,
  readWaveformSurferPalette,
  resolveCssColorExpression,
} from "./waveformThemeColors";
import { clearAllCspScopeRulesForTests } from "./cspNonceStyleRegistry";

afterEach(() => {
  clearAllCspScopeRulesForTests();
  invalidateWaveformSegmentBandPaletteCache();
  document.documentElement.removeAttribute("data-accent-theme");
  document.documentElement.style.removeProperty("--zen-wf-wave");
  document.documentElement.style.removeProperty("--zen-wf-progress-played");
  document.documentElement.style.removeProperty("--accent-action");
  document.documentElement.style.removeProperty(SEGMENT_FILL_CSS_VAR.inSelectionWaveform);
  document.documentElement.style.removeProperty(SEGMENT_FILL_CSS_VAR.visited);
  document.documentElement.style.removeProperty(SEGMENT_FILL_CSS_VAR.idle);
});

describe("readCssColorVar", () => {
  it("reads :root custom property with fallback", () => {
    document.documentElement.style.setProperty("--zen-wf-wave", "#abcdef");
    expect(readCssColorVar("--zen-wf-wave", COLORS.waveformWave)).toBe("#abcdef");
    expect(readCssColorVar("--zen-wf-missing", COLORS.waveformWave)).toBe(COLORS.waveformWave);
  });
});

describe("resolveCssColorExpression", () => {
  it("resolves solid rgb for canvas use", () => {
    const resolved = resolveCssColorExpression("rgb(255, 0, 0)", "rgb(0, 0, 0)");
    expect(resolved).toMatch(/^rgb/);
    expect(resolved).not.toBe("rgb(0, 0, 0)");
  });
});

describe("readWaveformSurferPalette", () => {
  it("returns wave/progress/cursor strings", () => {
    const palette = readWaveformSurferPalette();
    expect(palette.waveColor.length).toBeGreaterThan(0);
    expect(palette.progressColor.length).toBeGreaterThan(0);
    expect(palette.cursorColor.length).toBeGreaterThan(0);
  });
});

describe("readWaveformSegmentBandPalette", () => {
  it("returns distinct resolved fills for visited vs idle", () => {
    const palette = readWaveformSegmentBandPalette();
    expect(palette.selected).not.toBe(palette.idle);
    expect(palette.inSelection).not.toBe(palette.selected);
    expect(palette.visited).not.toBe(palette.idle);
    expect(palette.border.length).toBeGreaterThan(0);
  });

  it("uses accent-action for inSelection fallback under indigo theme", () => {
    document.documentElement.setAttribute("data-accent-theme", "indigo");
    document.documentElement.style.setProperty("--accent-action", "#3d4f5d");
    document.documentElement.style.removeProperty(SEGMENT_FILL_CSS_VAR.inSelectionWaveform);
    const palette = readWaveformSegmentBandPalette();
    expect(palette.inSelection).not.toMatch(/197,\s*138,\s*67|197, 138, 67|0\.772549 0\.541176 0\.262745/);
    expect(palette.inSelection).toMatch(/0\.239216|61,\s*79,\s*93|rgba\(61/);
  });
});
