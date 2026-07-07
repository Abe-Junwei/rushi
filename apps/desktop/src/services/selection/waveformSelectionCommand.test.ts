import { describe, expect, it, vi } from "vitest";
import {
  applyWaveformSelectionCommand,
  resolveWaveformSelectionTapCommand,
} from "./waveformSelectionCommand";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";

function makeCtx(selectedIdx: number): TranscriptionLayerInput {
  return {
    projectId: "p",
    fileId: "f",
    mediaUrl: null,
    segments: [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
      { uid: "b", idx: 1, start_sec: 2, end_sec: 4, text: "b" },
    ],
    selectedIdx,
    busy: false,
  } as TranscriptionLayerInput;
}

describe("waveformSelectionCommand", () => {
  it("resolves preview-synced tap away from segment start to seek-within", () => {
    expect(
      resolveWaveformSelectionTapCommand({
        ctx: makeCtx(0),
        segmentIdx: 1,
        pointerTimeSec: 3,
        tapGesture: {
          selectedIdxAtPointerDown: 0,
          viewportSyncedOnDown: true,
          sessionId: "s1",
        },
      }),
    ).toEqual({ kind: "seekWithinSegment", timeSec: 3 });
  });

  it("resolves preview-synced tap near segment start to select and seek start", () => {
    expect(
      resolveWaveformSelectionTapCommand({
        ctx: makeCtx(0),
        segmentIdx: 1,
        pointerTimeSec: 2.02,
        tapGesture: {
          selectedIdxAtPointerDown: 0,
          viewportSyncedOnDown: true,
          sessionId: "s1",
        },
      }),
    ).toEqual({ kind: "selectAndSeekStart", segmentIdx: 1, source: "waveform", sessionId: "s1" });
  });

  it("resolves selected segment tap to seek within segment", () => {
    expect(
      resolveWaveformSelectionTapCommand({
        ctx: makeCtx(1),
        segmentIdx: 1,
        pointerTimeSec: 99,
        tapGesture: {
          selectedIdxAtPointerDown: 1,
        },
      }),
    ).toEqual({ kind: "seekWithinSegment", timeSec: 4 });
  });

  it("applies select command with preview session id", () => {
    const selectSegmentAt = vi.fn();
    applyWaveformSelectionCommand(
      { kind: "selectAndSeekStart", segmentIdx: 1, source: "waveform", sessionId: "s1" },
      { selectSegmentAt, seekToTime: vi.fn() },
    );
    expect(selectSegmentAt).toHaveBeenCalledWith(1, "waveform", { previewSessionId: "s1" });
  });
});
