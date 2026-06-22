import { describe, expect, it } from "vitest";
import {
  isWaveformKeyboardBurstStep,
  shouldFocusWaveformShellForSelectSource,
  shouldSkipImperativeSelectionChrome,
  shouldSkipListScrollWhenInViewport,
} from "./waveformViewMode";

describe("waveformViewMode", () => {
  it("waveformKeyboard arrow steps use burst path unless shift/toggle", () => {
    expect(isWaveformKeyboardBurstStep("waveformKeyboard")).toBe(true);
    expect(isWaveformKeyboardBurstStep("waveformKeyboard", { shiftKey: true })).toBe(false);
    expect(isWaveformKeyboardBurstStep("waveformKeyboard", { toggle: true })).toBe(false);
    expect(isWaveformKeyboardBurstStep("waveform")).toBe(false);
  });
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

  it("hot select paths skip imperative overlay CSP", () => {
    expect(shouldSkipImperativeSelectionChrome("waveform")).toBe(true);
    expect(shouldSkipImperativeSelectionChrome("waveformKeyboard")).toBe(true);
    expect(shouldSkipImperativeSelectionChrome("list")).toBe(true);
    expect(shouldSkipImperativeSelectionChrome("listAdvance")).toBe(true);
    expect(shouldSkipImperativeSelectionChrome("listKeyboard")).toBe(true);
    expect(shouldSkipImperativeSelectionChrome("contextMenu")).toBe(true);
    expect(shouldSkipImperativeSelectionChrome("multiSelect")).toBe(true);
  });
});
