import { renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWaveformSegmentDrag, type WaveformSegmentDragArgs } from "./useWaveformSegmentDrag";
import type { CreateRangePreview, SegmentOverlayDraft } from "../utils/waveformSegmentOverlayGeometry";
import { resetWaveformSegmentInteractionSessionIdsForTests } from "../services/waveform/waveformSegmentInteractionStateMachine";

function makeArgs(overrides: Partial<WaveformSegmentDragArgs> = {}): WaveformSegmentDragArgs {
  return {
    disabled: false,
    segments: [{ uid: "a", idx: 0, start_sec: 0, end_sec: 2, text: "A" }],
    selectedIdx: -1,
    timelineWidthPx: 1000,
    durationSec: 10,
    layoutHeightPx: 96,
    laneByIndex: [0],
    laneCount: 1,
    enableCreateRange: true,
    clientXToTimeSec: () => 1,
    onSelectSegmentAt: vi.fn(),
    onBoundsCommit: vi.fn(),
    seekToTime: vi.fn(),
    ...overrides,
  };
}

function makePointerEvent(overrides: Partial<PointerEvent<HTMLElement>> = {}): PointerEvent<HTMLElement> {
  const currentTarget = document.createElement("div");
  currentTarget.setPointerCapture = vi.fn();
  currentTarget.releasePointerCapture = vi.fn();
  return {
    button: 0,
    pointerId: 7,
    clientX: 100,
    clientY: 0,
    currentTarget,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...overrides,
  } as PointerEvent<HTMLElement>;
}

describe("useWaveformSegmentDrag event boundaries", () => {
  beforeEach(() => {
    resetWaveformSegmentInteractionSessionIdsForTests();
  });

  it("cancels an active segment tap without committing selection or seek", () => {
    const onSelectSegmentAt = vi.fn();
    const seekToTime = vi.fn();
    const onSegmentPointerTap = vi.fn();
    const applySegmentDraft = vi.fn();
    const updateCreatePreview = vi.fn();
    const args = makeArgs({ onSelectSegmentAt, seekToTime });

    const { result } = renderHook(() =>
      useWaveformSegmentDrag(
        { current: args },
        applySegmentDraft,
        updateCreatePreview,
        onSegmentPointerTap,
      ),
    );

    result.current.onSegmentPointerDown(0, makePointerEvent());
    result.current.onPointerCancel(makePointerEvent());

    expect(applySegmentDraft).toHaveBeenLastCalledWith(null);
    expect(updateCreatePreview).toHaveBeenLastCalledWith(null);
    expect(onSegmentPointerTap).not.toHaveBeenCalled();
    expect(onSelectSegmentAt).not.toHaveBeenCalled();
    expect(seekToTime).not.toHaveBeenCalled();
  });

  it("consumes pointerdown tap gesture only once for click fallback", () => {
    const args = makeArgs({
      selectedIdx: 3,
      onWaveformSelectionGesture: vi.fn(() => true),
    });
    const { result } = renderHook(() =>
      useWaveformSegmentDrag(
        { current: args },
        vi.fn<(draft: SegmentOverlayDraft | null) => void>(),
        vi.fn<(preview: CreateRangePreview | null) => void>(),
        vi.fn(),
      ),
    );

    result.current.onSegmentPointerDown(0, makePointerEvent());

    expect(result.current.consumeLastSegmentTapGesture(0)).toEqual({
      selectedIdxAtPointerDown: 3,
      viewportSyncedOnDown: true,
      sessionId: "wfseg-1",
    });
    expect(result.current.consumeLastSegmentTapGesture(0)).toBeUndefined();
  });
});
