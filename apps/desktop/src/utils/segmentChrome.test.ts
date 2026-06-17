import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentPlaybackVisits, waveformRegionFillColor } from "./segmentChrome";

function seg(partial: Partial<SegmentDto> & Pick<SegmentDto, "start_sec" | "end_sec">): SegmentDto {
  return {
    idx: 0,
    text: "x",
    low_confidence: false,
    ...partial,
  };
}

describe("segmentChrome", () => {
  it("treats playhead past segment start as visited", () => {
    const s = seg({ start_sec: 1, end_sec: 3 });
    expect(segmentPlaybackVisits(s, 0.5)).toBe("unplayed");
    expect(segmentPlaybackVisits(s, 1.05)).toBe("visited");
    expect(segmentPlaybackVisits(s, 2)).toBe("visited");
    expect(segmentPlaybackVisits(s, 3)).toBe("visited");
  });

  it("uses saffron progress tint for visited unselected segments", () => {
    const s = seg({ start_sec: 0, end_sec: 2 });
    const visited = waveformRegionFillColor(s, false, false, 1);
    const idle = waveformRegionFillColor(s, false, false, 0);
    expect(visited).toContain("--zen-saffron-mid");
    expect(idle).toContain("--zen-ink");
    expect(visited).not.toBe(idle);
  });

  it("keeps indigo for selected over visited", () => {
    const s = seg({ start_sec: 0, end_sec: 2 });
    const fill = waveformRegionFillColor(s, true, false, 2);
    expect(fill).toContain("--accent-edit");
  });
});
