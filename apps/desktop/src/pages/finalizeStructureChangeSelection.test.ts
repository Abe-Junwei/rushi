import { describe, expect, it, vi } from "vitest";
import { finalizeStructureChangeSelection } from "./finalizeStructureChangeSelection";
import type { SegmentDto } from "../tauri/projectApi";

function seg(start: number, end: number): SegmentDto {
  return {
    idx: 0,
    start_sec: start,
    end_sec: end,
    text: "",
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("finalizeStructureChangeSelection", () => {
  it("selects playhead half and forwards post-mutation segments to remap", () => {
    const setSelectedIdx = vi.fn();
    const onSelectionCollapsed = vi.fn();
    const onStructurePlaybackRemap = vi.fn();
    const parts = [seg(0, 5), seg(5, 10)];

    const idx = finalizeStructureChangeSelection({
      segments: parts,
      playheadSec: 7,
      setSelectedIdx,
      onSelectionCollapsed,
      onStructurePlaybackRemap,
    });

    expect(idx).toBe(1);
    expect(setSelectedIdx).toHaveBeenCalledWith(1);
    expect(onSelectionCollapsed).toHaveBeenCalledWith(1);
    expect(onStructurePlaybackRemap).toHaveBeenCalledWith(7, parts);
  });

  it("seam time selects right half", () => {
    const setSelectedIdx = vi.fn();
    const parts = [seg(0, 5), seg(5, 10)];
    finalizeStructureChangeSelection({
      segments: parts,
      playheadSec: 5,
      setSelectedIdx,
    });
    expect(setSelectedIdx).toHaveBeenCalledWith(1);
  });

  it("playhead inside affected bounds follows the containing half", () => {
    const setSelectedIdx = vi.fn();
    // Split of segment [0,10] → halves [0,5],[5,10]; segment C at idx 2.
    const parts = [seg(0, 5), seg(5, 10), seg(10, 20)];
    finalizeStructureChangeSelection({
      segments: parts,
      playheadSec: 7,
      setSelectedIdx,
      affectedBounds: { startSec: 0, endSec: 10 },
      fallbackIdx: 1,
    });
    expect(setSelectedIdx).toHaveBeenCalledWith(1);
  });

  it("playhead outside affected bounds keeps fallback index (no jump-away)", () => {
    const setSelectedIdx = vi.fn();
    const onStructurePlaybackRemap = vi.fn();
    // Edited segment is C[20,30]→C1[20,25],C2[25,30]; playhead at 3 sits in A.
    const parts = [seg(0, 10), seg(10, 20), seg(20, 25), seg(25, 30)];
    const idx = finalizeStructureChangeSelection({
      segments: parts,
      playheadSec: 3,
      setSelectedIdx,
      onStructurePlaybackRemap,
      affectedBounds: { startSec: 20, endSec: 30 },
      fallbackIdx: 3,
    });
    // Selection stays on the split result (right half), not segment A.
    expect(idx).toBe(3);
    expect(setSelectedIdx).toHaveBeenCalledWith(3);
    // Sticky playback still remaps by playhead geometry.
    expect(onStructurePlaybackRemap).toHaveBeenCalledWith(3, parts);
  });
});
