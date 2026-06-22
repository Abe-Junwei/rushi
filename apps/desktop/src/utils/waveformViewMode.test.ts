import { describe, expect, it } from "vitest";
import {
  shouldFocusWaveformShellForSelectSource,
  shouldSkipListScrollWhenInViewport,
} from "./waveformViewMode";

describe("waveformViewMode", () => {
  it("waveform sources skip in-viewport list scroll", () => {
    expect(shouldSkipListScrollWhenInViewport("waveform")).toBe(true);
    expect(shouldSkipListScrollWhenInViewport("waveformKeyboard")).toBe(true);
    expect(shouldSkipListScrollWhenInViewport("list")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("listAdvance")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("listKeyboard")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("contextMenu")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("multiSelect")).toBe(false);
  });

  it("waveform sources focus waveform shell", () => {
    expect(shouldFocusWaveformShellForSelectSource("waveform")).toBe(true);
    expect(shouldFocusWaveformShellForSelectSource("waveformKeyboard")).toBe(true);
    expect(shouldFocusWaveformShellForSelectSource("multiSelect")).toBe(false);
    expect(shouldFocusWaveformShellForSelectSource("contextMenu")).toBe(false);
  });
});
