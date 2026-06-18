import { afterEach, describe, expect, it } from "vitest";
import { COLORS } from "../config/tokens";
import { SEGMENT_FILL_CSS_VAR } from "../config/segmentFillTokens";
import {
  readCssColorVar,
  readWaveformSegmentBandPalette,
  readWaveformSurferPalette,
  resolveCssColorExpression,
} from "./waveformThemeColors";
import { clearAllCspScopeRulesForTests } from "./cspNonceStyleRegistry";

afterEach(() => {
  clearAllCspScopeRulesForTests();
  document.documentElement.style.removeProperty("--zen-wf-wave");
  document.documentElement.style.removeProperty("--zen-wf-progress-played");
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
});
