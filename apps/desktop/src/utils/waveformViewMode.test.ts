import { describe, expect, it } from "vitest";
import {
  shouldFocusWaveformShellForSelectSource,
  shouldSkipListScrollWhenInViewport,
} from "./waveformViewMode";

describe("waveformViewMode", () => {
  it("only waveform skips in-viewport list scroll", () => {
    expect(shouldSkipListScrollWhenInViewport("waveform")).toBe(true);
    expect(shouldSkipListScrollWhenInViewport("list")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("listAdvance")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("listKeyboard")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("contextMenu")).toBe(false);
    expect(shouldSkipListScrollWhenInViewport("multiSelect")).toBe(false);
  });

  it("only waveform selection focuses waveform shell", () => {
    expect(shouldFocusWaveformShellForSelectSource("waveform")).toBe(true);
    expect(shouldFocusWaveformShellForSelectSource("multiSelect")).toBe(false);
    expect(shouldFocusWaveformShellForSelectSource("contextMenu")).toBe(false);
  });
});
