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

  it("preventDefault on blank shell and segment pointerdown (WebView2 drag flash)", () => {
    const seekBlankToTime = vi.fn();
    const seekToTime = vi.fn();
    const args = makeArgs({
      seekBlankToTime,
      seekToTime,
      enableCreateRange: false,
      segments: [],
      laneByIndex: [],
      laneCount: 1,
      clientXToTimeSec: () => 5,
    });
    const { result } = renderHook(() =>
      useWaveformSegmentDrag({ current: args }, vi.fn(), vi.fn(), vi.fn()),
    );
    const blankEv = makePointerEvent({ clientY: 40 });
    Object.defineProperty(blankEv.currentTarget, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 1000, height: 96, right: 1000, bottom: 96 }),
    });
    result.current.onShellPointerDown(blankEv);
    expect(blankEv.preventDefault).toHaveBeenCalled();
    expect(seekBlankToTime).toHaveBeenCalledWith(5);

    const segArgs = makeArgs({ seekToTime });
    const { result: segResult } = renderHook(() =>
      useWaveformSegmentDrag({ current: segArgs }, vi.fn(), vi.fn(), vi.fn()),
    );
    const segEv = makePointerEvent();
    segResult.current.onSegmentPointerDown(0, segEv);
    expect(segEv.preventDefault).toHaveBeenCalled();
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

  it("window blur cancels a stuck drag (Windows WebView2 focus-toggle can swallow pointerup)", () => {
    const applySegmentDraft = vi.fn();
    const updateCreatePreview = vi.fn();
    const args = makeArgs();
    const { result } = renderHook(() =>
      useWaveformSegmentDrag({ current: args }, applySegmentDraft, updateCreatePreview, vi.fn()),
    );

    result.current.onSegmentPointerDown(0, makePointerEvent());
    expect(result.current.dragRef.current).not.toBeNull();
    applySegmentDraft.mockClear();
    updateCreatePreview.mockClear();

    window.dispatchEvent(new Event("blur"));

    expect(result.current.dragRef.current).toBeNull();
    expect(applySegmentDraft).toHaveBeenLastCalledWith(null);
    expect(updateCreatePreview).toHaveBeenLastCalledWith(null);
  });

  it("window pointerup with matching pointerId cancels a drag the captured element never saw", () => {
    const applySegmentDraft = vi.fn();
    const args = makeArgs();
    const { result } = renderHook(() =>
      useWaveformSegmentDrag({ current: args }, applySegmentDraft, vi.fn(), vi.fn()),
    );

    result.current.onSegmentPointerDown(0, makePointerEvent({ pointerId: 9 }));
    applySegmentDraft.mockClear();

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 9 }));

    expect(result.current.dragRef.current).toBeNull();
    expect(applySegmentDraft).toHaveBeenLastCalledWith(null);
  });

  it("window pointerup with an unrelated pointerId leaves an active drag untouched", () => {
    const applySegmentDraft = vi.fn();
    const args = makeArgs();
    const { result } = renderHook(() =>
      useWaveformSegmentDrag({ current: args }, applySegmentDraft, vi.fn(), vi.fn()),
    );

    result.current.onSegmentPointerDown(0, makePointerEvent({ pointerId: 9 }));
    applySegmentDraft.mockClear();

    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 42 }));

    expect(result.current.dragRef.current).not.toBeNull();
    expect(applySegmentDraft).not.toHaveBeenCalled();
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
