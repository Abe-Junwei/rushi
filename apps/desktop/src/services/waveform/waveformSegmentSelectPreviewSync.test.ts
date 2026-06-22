import { beforeEach, describe, expect, it } from "vitest";
import {
  clearWaveformSegmentPreviewViewportSync,
  consumeWaveformSegmentPreviewViewportSync,
  markWaveformSegmentPreviewViewportSynced,
  resetWaveformSegmentPreviewViewportSyncForTests,
} from "./waveformSegmentSelectPreviewSync";

describe("waveformSegmentSelectPreviewSync", () => {
  beforeEach(() => {
    resetWaveformSegmentPreviewViewportSyncForTests();
  });

  it("consumes matching idx/session once", () => {
    markWaveformSegmentPreviewViewportSynced(3, "s1");
    expect(consumeWaveformSegmentPreviewViewportSync(3, "s1")).toBe(true);
    expect(consumeWaveformSegmentPreviewViewportSync(3, "s1")).toBe(false);
  });

  it("rejects mismatched idx", () => {
    markWaveformSegmentPreviewViewportSynced(3, "s1");
    expect(consumeWaveformSegmentPreviewViewportSync(4, "s1")).toBe(false);
    expect(consumeWaveformSegmentPreviewViewportSync(3, "s1")).toBe(true);
  });

  it("rejects mismatched session without consuming", () => {
    markWaveformSegmentPreviewViewportSynced(2, "s1");
    expect(consumeWaveformSegmentPreviewViewportSync(2, "s2")).toBe(false);
    expect(consumeWaveformSegmentPreviewViewportSync(2, "s1")).toBe(true);
  });

  it("clear removes pending sync", () => {
    markWaveformSegmentPreviewViewportSynced(1, "s1");
    clearWaveformSegmentPreviewViewportSync();
    expect(consumeWaveformSegmentPreviewViewportSync(1, "s1")).toBe(false);
  });

  it("keeps legacy no-session consume for non-session callers", () => {
    markWaveformSegmentPreviewViewportSynced(1);
    expect(consumeWaveformSegmentPreviewViewportSync(1)).toBe(true);
  });
});
