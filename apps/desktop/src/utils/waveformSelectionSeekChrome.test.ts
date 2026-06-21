import { describe, expect, it } from "vitest";
import {
  SELECTION_SEEK_CHROME_SUPPRESS_MS,
  selectionSeekChromeSuppressUntil,
  shouldCoalesceSelectionSeekChrome,
} from "./waveformSelectionSeekChrome";

describe("waveformSelectionSeekChrome", () => {
  it("uses a 1200ms suppress window aligned with playback-follow guard", () => {
    expect(SELECTION_SEEK_CHROME_SUPPRESS_MS).toBe(1200);
    expect(selectionSeekChromeSuppressUntil(1000)).toBe(2200);
  });

  it("coalesces seeking chrome while suppress window is active", () => {
    expect(shouldCoalesceSelectionSeekChrome(1500, 2200)).toBe(true);
    expect(shouldCoalesceSelectionSeekChrome(2200, 2200)).toBe(false);
    expect(shouldCoalesceSelectionSeekChrome(2300, 2200)).toBe(false);
  });
});
