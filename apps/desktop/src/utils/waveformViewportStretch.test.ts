import { afterEach, describe, expect, it } from "vitest";
import { readCspLayoutRulesForElement } from "./cspElementLayout";
import { clearAllCspScopeRulesForTests } from "./cspNonceStyleRegistry";
import {
  applyWaveformViewportStretch,
  clearWaveformViewportStretch,
  computeViewportStretchRatio,
  writeWaveformPeaksStageShellWidth,
  writeWaveformShellLayout,
  writeWaveformStickyShellWidth,
  writeWaveformTimelineShellWidth,
} from "./waveformViewportStretch";

describe("waveformViewportStretch", () => {
  afterEach(() => {
    clearAllCspScopeRulesForTests();
  });

  it("writes sticky shell width in pixels", () => {
    const el = document.createElement("div");
    writeWaveformStickyShellWidth(el, 1280);
    expect(readCspLayoutRulesForElement(el)).toContain("width: 1280px");
  });

  it("writes timeline and stage shell widths in pixels", () => {
    const timeline = document.createElement("div");
    const stage = document.createElement("div");
    writeWaveformTimelineShellWidth(timeline, 1400);
    writeWaveformPeaksStageShellWidth(stage, 1600);
    expect(readCspLayoutRulesForElement(timeline)).toContain("width: 1400px");
    expect(readCspLayoutRulesForElement(stage)).toContain("width: 1600px");
  });

  it("writes timeline, stage, and sticky via writeWaveformShellLayout", () => {
    const timeline = document.createElement("div");
    const stage = document.createElement("div");
    const sticky = document.createElement("div");
    writeWaveformShellLayout({
      timelineShell: timeline,
      peaksStageShell: stage,
      stickyShell: sticky,
      timelineWidthPx: 900,
      viewportWidthPx: 1200,
    });
    expect(readCspLayoutRulesForElement(timeline)).toContain("width: 900px");
    expect(readCspLayoutRulesForElement(stage)).toContain("width: 1200px");
    expect(readCspLayoutRulesForElement(sticky)).toContain("width: 1200px");
  });

  it("applies and clears horizontal stretch", () => {
    const el = document.createElement("div");
    applyWaveformViewportStretch(el, 2);
    expect(readCspLayoutRulesForElement(el)).toContain("scaleX(2)");
    clearWaveformViewportStretch(el);
    expect(readCspLayoutRulesForElement(el)).toBeUndefined();
  });

  it("computes stretch ratio only when width changes", () => {
    expect(computeViewportStretchRatio(800, 1600)).toBe(2);
    expect(computeViewportStretchRatio(800, 800)).toBeNull();
  });
});
