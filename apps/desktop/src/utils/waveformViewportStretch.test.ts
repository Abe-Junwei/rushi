import { describe, expect, it } from "vitest";
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
  it("writes sticky shell width in pixels", () => {
    const el = document.createElement("div");
    writeWaveformStickyShellWidth(el, 1280);
    expect(el.style.width).toBe("1280px");
  });

  it("writes timeline and stage shell widths in pixels", () => {
    const timeline = document.createElement("div");
    const stage = document.createElement("div");
    writeWaveformTimelineShellWidth(timeline, 1400);
    writeWaveformPeaksStageShellWidth(stage, 1600);
    expect(timeline.style.width).toBe("1400px");
    expect(stage.style.width).toBe("1600px");
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
    expect(timeline.style.width).toBe("900px");
    expect(stage.style.width).toBe("1200px");
    expect(sticky.style.width).toBe("1200px");
  });

  it("applies and clears horizontal stretch", () => {
    const el = document.createElement("div");
    applyWaveformViewportStretch(el, 2);
    expect(el.style.transform).toBe("scaleX(2)");
    clearWaveformViewportStretch(el);
    expect(el.style.transform).toBe("");
  });

  it("computes stretch ratio only when width changes", () => {
    expect(computeViewportStretchRatio(800, 1600)).toBe(2);
    expect(computeViewportStretchRatio(800, 800)).toBeNull();
  });
});
