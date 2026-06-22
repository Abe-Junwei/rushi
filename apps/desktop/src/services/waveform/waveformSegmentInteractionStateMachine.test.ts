import { describe, expect, it } from "vitest";
import {
  beginWaveformSegmentInteraction,
  beginWaveformSegmentLassoInteraction,
  cancelWaveformSegmentInteraction,
  commitWaveformSegmentInteraction,
  consumeWaveformSegmentTapGesture,
  markWaveformSegmentInteractionMoved,
  resetWaveformSegmentInteractionSessionIdsForTests,
} from "./waveformSegmentInteractionStateMachine";

describe("waveformSegmentInteractionStateMachine", () => {
  it("creates a stable tap session and consumes its tap gesture", () => {
    resetWaveformSegmentInteractionSessionIdsForTests();
    const { state, draft } = beginWaveformSegmentInteraction({
      mode: "move",
      pointerId: 7,
      segmentIdx: 2,
      anchorTimeSec: 12,
      anchorClientX: 100,
      initialStartSec: 10,
      initialEndSec: 14,
      selectedIdxAtPointerDown: 1,
      viewportSyncedOnDown: true,
    });

    expect(state.sessionId).toBe("wfseg-1");
    expect(draft).toEqual({ idx: 2, startSec: 10, endSec: 14 });
    expect(consumeWaveformSegmentTapGesture(state, 2)).toEqual({
      selectedIdxAtPointerDown: 1,
      viewportSyncedOnDown: true,
      sessionId: "wfseg-1",
    });
    expect(consumeWaveformSegmentTapGesture(state, 3)).toBeUndefined();
  });

  it("cancels without producing a consumable tap gesture", () => {
    const { state } = beginWaveformSegmentInteraction({
      mode: "move",
      pointerId: 7,
      segmentIdx: 0,
      anchorTimeSec: 1,
      anchorClientX: 100,
      initialStartSec: 0,
      initialEndSec: 2,
      selectedIdxAtPointerDown: -1,
    });

    const cancelled = cancelWaveformSegmentInteraction(state);
    expect(cancelled).toEqual({ phase: "cancelled", sessionId: state.sessionId });
    expect(consumeWaveformSegmentTapGesture(cancelled, 0)).toBeUndefined();
  });

  it("promotes pending tap to dragging edit when movement crosses threshold", () => {
    const { state } = beginWaveformSegmentInteraction({
      mode: "move",
      pointerId: 7,
      segmentIdx: 0,
      anchorTimeSec: 1,
      anchorClientX: 100,
      initialStartSec: 0,
      initialEndSec: 2,
      selectedIdxAtPointerDown: -1,
    });

    const moved = markWaveformSegmentInteractionMoved(state);

    expect(moved.phase).toBe("draggingEdit");
    expect(consumeWaveformSegmentTapGesture(moved, 0)).toEqual({
      selectedIdxAtPointerDown: -1,
      viewportSyncedOnDown: undefined,
      sessionId: state.sessionId,
    });
  });

  it("creates lasso sessions independently from segment tap sessions", () => {
    const lasso = beginWaveformSegmentLassoInteraction({
      pointerId: 3,
      anchorTimeSec: 5,
      anchorClientX: 40,
      selectedIdxAtPointerDown: 1,
      baseIndices: new Set([1]),
      sessionId: "lasso-a",
    });

    expect(lasso.phase).toBe("lasso");
    expect(lasso.drag.sessionId).toBe("lasso-a");
    expect(commitWaveformSegmentInteraction(lasso)).toEqual({ phase: "committed", sessionId: "lasso-a" });
  });
});
