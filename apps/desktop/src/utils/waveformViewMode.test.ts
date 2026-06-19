import { describe, expect, it } from "vitest";
import {
  shouldEnterZoomForOverlayGesture,
  shouldFitSelectionOnWaveformSelect,
  shouldFocusWaveformShellForSelectSource,
} from "./waveformViewMode";

describe("waveformViewMode", () => {
  it("re-fits on waveform select only while in fit-selection mode", () => {
    expect(shouldFitSelectionOnWaveformSelect("waveform", "fit-selection")).toBe(true);
    expect(shouldFitSelectionOnWaveformSelect("waveform", "manual")).toBe(false);
    expect(shouldFitSelectionOnWaveformSelect("waveform", "fit-all")).toBe(false);
    expect(shouldFitSelectionOnWaveformSelect("list", "fit-selection")).toBe(false);
    expect(shouldFitSelectionOnWaveformSelect("listAdvance", "fit-selection")).toBe(false);
  });

  it("focuses waveform shell only for waveform selection", () => {
    expect(shouldFocusWaveformShellForSelectSource("waveform")).toBe(true);
    expect(shouldFocusWaveformShellForSelectSource("list")).toBe(false);
  });

  it("enters zoom mode for segment drag gestures", () => {
    expect(shouldEnterZoomForOverlayGesture("move")).toBe(true);
    expect(shouldEnterZoomForOverlayGesture("create")).toBe(false);
  });
});
