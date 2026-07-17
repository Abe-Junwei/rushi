import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runWithTranscriptStructureBridgeGate,
  shouldSkipTranscriptExternalStructureSync,
} from "./transcriptStructureBridgeGate";

describe("transcript structure bridge gate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips external sync during gate and clears after timeout", () => {
    vi.useFakeTimers();
    expect(shouldSkipTranscriptExternalStructureSync()).toBe(false);
    const out = runWithTranscriptStructureBridgeGate(() => {
      expect(shouldSkipTranscriptExternalStructureSync()).toBe(true);
      return 7;
    });
    expect(out).toBe(7);
    expect(shouldSkipTranscriptExternalStructureSync()).toBe(true);
    vi.runAllTimers();
    expect(shouldSkipTranscriptExternalStructureSync()).toBe(false);
  });
});
