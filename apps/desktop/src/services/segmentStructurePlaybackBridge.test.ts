import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStructurePlayheadSec,
  registerSegmentStructurePlaybackBridge,
  remapStructurePlayback,
} from "./segmentStructurePlaybackBridge";

describe("segmentStructurePlaybackBridge", () => {
  afterEach(() => {
    registerSegmentStructurePlaybackBridge(null);
  });

  it("returns 0 when unregistered", () => {
    expect(getStructurePlayheadSec()).toBe(0);
  });

  it("forwards playhead and remap to the registered bridge", () => {
    const remap = vi.fn((t: number) => Math.floor(t));
    const segs = [{ start_sec: 0, end_sec: 1 } as never];
    registerSegmentStructurePlaybackBridge({
      getPlayheadSec: () => 12.5,
      remapAfterStructureChange: remap,
    });
    expect(getStructurePlayheadSec()).toBe(12.5);
    remapStructurePlayback(12.5, segs);
    expect(remap).toHaveBeenCalledWith(12.5, segs);
  });
});
