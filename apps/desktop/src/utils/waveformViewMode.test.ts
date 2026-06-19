import { describe, expect, it } from "vitest";
import {
  shouldEnterZoomForOverlayGesture,
  shouldFocusWaveformShellForSelectSource,
} from "./waveformViewMode";

describe("waveformViewMode", () => {
  it("focuses waveform shell only for waveform selection", () => {
    expect(shouldFocusWaveformShellForSelectSource("waveform")).toBe(true);
    expect(shouldFocusWaveformShellForSelectSource("list")).toBe(false);
  });

  it("enters zoom mode for segment drag gestures", () => {
    expect(shouldEnterZoomForOverlayGesture("move")).toBe(true);
    expect(shouldEnterZoomForOverlayGesture("create")).toBe(false);
  });
});
