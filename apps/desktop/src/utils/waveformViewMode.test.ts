import { describe, expect, it } from "vitest";
import { shouldEnterZoomForOverlayGesture, shouldFocusWaveformShellForSelectSource } from "./waveformViewMode";

describe("waveformViewMode", () => {
  it("flags resize/move gestures for overlay", () => {
    expect(shouldEnterZoomForOverlayGesture("resize-start")).toBe(true);
    expect(shouldEnterZoomForOverlayGesture("resize-end")).toBe(true);
    expect(shouldEnterZoomForOverlayGesture("move")).toBe(true);
    expect(shouldEnterZoomForOverlayGesture("create")).toBe(false);
  });

  it("does not focus waveform for list selection", () => {
    expect(shouldFocusWaveformShellForSelectSource("list")).toBe(false);
  });

  it("focuses waveform for waveform and global-strip", () => {
    expect(shouldFocusWaveformShellForSelectSource("waveform")).toBe(true);
    expect(shouldFocusWaveformShellForSelectSource("global-strip")).toBe(true);
  });
});
