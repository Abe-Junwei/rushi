import { describe, expect, it, vi } from "vitest";
import { finishWaveformLassoDrag } from "./waveformSegmentDragHelpers";
import type { WaveformSegmentDragArgs } from "./useWaveformSegmentDrag";
import type { OverlayDragState } from "../utils/waveformSegmentOverlayGeometry";

function makeLassoDrag(overrides: Partial<OverlayDragState> = {}): OverlayDragState {
  return {
    mode: "lasso",
    pointerId: 1,
    segmentIdx: -1,
    anchorTimeSec: 12.5,
    anchorClientX: 100,
    initialStartSec: 12.5,
    initialEndSec: 12.5,
    moved: false,
    ...overrides,
  };
}

function makeArgs(overrides: Partial<WaveformSegmentDragArgs> = {}): WaveformSegmentDragArgs {
  return {
    disabled: false,
    segments: [],
    selectedIdx: 0,
    timelineWidthPx: 1000,
    durationSec: 600,
    layoutHeightPx: 96,
    laneByIndex: [],
    laneCount: 1,
    enableCreateRange: true,
    clientXToTimeSec: () => 12.5,
    onSelectSegmentAt: vi.fn(),
    onBoundsCommit: vi.fn(),
    seekToTime: vi.fn(),
    onFocusWaveformShell: vi.fn(),
    isMultiSegmentSelection: () => false,
    ...overrides,
  };
}

describe("finishWaveformLassoDrag", () => {
  it("short tap with shift skips seek (H19)", () => {
    const seekToTime = vi.fn();
    const args = makeArgs({ seekToTime });
    finishWaveformLassoDrag({
      drag: makeLassoDrag(),
      timeSec: 12.5,
      args,
      snapEnabled: false,
      modifiers: { shiftKey: true, toggleKey: false, altKey: false },
      suppressClickAfterPointer: vi.fn(),
    });
    expect(seekToTime).not.toHaveBeenCalled();
  });

  it("short tap with toggle skips seek", () => {
    const seekToTime = vi.fn();
    const args = makeArgs({ seekToTime });
    finishWaveformLassoDrag({
      drag: makeLassoDrag(),
      timeSec: 12.5,
      args,
      snapEnabled: false,
      modifiers: { shiftKey: false, toggleKey: true, altKey: false },
      suppressClickAfterPointer: vi.fn(),
    });
    expect(seekToTime).not.toHaveBeenCalled();
  });

  it("short tap without modifier seeks when not multi-select", () => {
    const seekToTime = vi.fn();
    const args = makeArgs({ seekToTime });
    finishWaveformLassoDrag({
      drag: makeLassoDrag(),
      timeSec: 12.5,
      args,
      snapEnabled: false,
      modifiers: { shiftKey: false, toggleKey: false, altKey: false },
      suppressClickAfterPointer: vi.fn(),
    });
    expect(seekToTime).toHaveBeenCalledWith(12.5);
  });

  it("blank lasso creates when drag stays in a gap with no segment hits", () => {
    const onCreateRange = vi.fn();
    const onSelectSegmentIndices = vi.fn();
    const args = makeArgs({
      durationSec: 20,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 5, text: "A" },
        { uid: "b", idx: 1, start_sec: 10, end_sec: 15, text: "B" },
      ],
      onCreateRange,
      onSelectSegmentIndices,
    });
    finishWaveformLassoDrag({
      drag: makeLassoDrag({
        moved: true,
        blankLasso: true,
        initialStartSec: 5.2,
        initialEndSec: 5.2,
      }),
      timeSec: 9.5,
      args,
      snapEnabled: false,
      modifiers: { shiftKey: false, toggleKey: false, altKey: false },
      suppressClickAfterPointer: vi.fn(),
    });
    expect(onCreateRange).toHaveBeenCalled();
    expect(onSelectSegmentIndices).not.toHaveBeenCalled();
  });

  it("blank lasso multi-selects intersecting segments instead of creating in a trimmed gap", () => {
    const onCreateRange = vi.fn();
    const onSelectSegmentIndices = vi.fn();
    const args = makeArgs({
      durationSec: 20,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 5, text: "A" },
        { uid: "b", idx: 1, start_sec: 10, end_sec: 15, text: "B" },
      ],
      onCreateRange,
      onSelectSegmentIndices,
    });
    finishWaveformLassoDrag({
      drag: makeLassoDrag({
        moved: true,
        blankLasso: true,
        initialStartSec: 1,
        initialEndSec: 1,
      }),
      timeSec: 12,
      args,
      snapEnabled: false,
      modifiers: { shiftKey: false, toggleKey: false, altKey: false },
      suppressClickAfterPointer: vi.fn(),
    });
    expect(onSelectSegmentIndices).toHaveBeenCalledWith([0, 1], 0);
    expect(onCreateRange).not.toHaveBeenCalled();
  });

  it("blank lasso selects a single intersecting segment", () => {
    const onCreateRange = vi.fn();
    const onSelectSegmentIndices = vi.fn();
    const args = makeArgs({
      durationSec: 20,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 5, text: "A" },
        { uid: "b", idx: 1, start_sec: 10, end_sec: 15, text: "B" },
      ],
      onCreateRange,
      onSelectSegmentIndices,
    });
    finishWaveformLassoDrag({
      drag: makeLassoDrag({
        moved: true,
        blankLasso: true,
        initialStartSec: 1,
        initialEndSec: 1,
      }),
      timeSec: 3,
      args,
      snapEnabled: false,
      modifiers: { shiftKey: false, toggleKey: false, altKey: false },
      suppressClickAfterPointer: vi.fn(),
    });
    expect(onSelectSegmentIndices).toHaveBeenCalledWith([0], 0);
    expect(onCreateRange).not.toHaveBeenCalled();
  });
});
