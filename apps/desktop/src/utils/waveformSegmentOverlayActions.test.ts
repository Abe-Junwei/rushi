import { describe, expect, it, vi } from "vitest";
import { applyOverlayPointerUpIntent } from "./waveformSegmentOverlayActions";

describe("waveformSegmentOverlayActions", () => {
  it("applyOverlayPointerUpIntent dispatches select-segment", () => {
    const suppress = vi.fn();
    const onSelectSegmentAt = vi.fn();
    applyOverlayPointerUpIntent(
      { kind: "select-segment", segmentIdx: 2 },
      {
        onSelectSegmentAt,
        onBoundsCommit: vi.fn(),
        seekToTime: vi.fn(),
      },
      suppress,
    );
    expect(suppress).toHaveBeenCalledOnce();
    expect(onSelectSegmentAt).toHaveBeenCalledWith(2);
  });

  it("applyOverlayPointerUpIntent dispatches commit-bounds", () => {
    const onBoundsCommit = vi.fn();
    applyOverlayPointerUpIntent(
      { kind: "commit-bounds", segmentIdx: 1, startSec: 2, endSec: 4 },
      {
        onSelectSegmentAt: vi.fn(),
        onBoundsCommit,
        seekToTime: vi.fn(),
      },
      vi.fn(),
    );
    expect(onBoundsCommit).toHaveBeenCalledWith(1, 2, 4);
  });
});
