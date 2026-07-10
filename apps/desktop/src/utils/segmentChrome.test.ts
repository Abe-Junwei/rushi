import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { SEGMENT_FILL_CSS_VAR } from "../config/segmentFillTokens";
import {
  resolveWaveformSegmentFillState,
  segmentPlaybackVisits,
  waveformRegionFillColor,
} from "./segmentChrome";

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

  it("tints unselected visited segments when playback has passed them", () => {
    const s = seg({ start_sec: 0, end_sec: 2 });
    const visited = waveformRegionFillColor(s, false, false, 1);
    const idle = waveformRegionFillColor(s, false, false, 0);
    expect(visited).toBe(`var(${SEGMENT_FILL_CSS_VAR.visited})`);
    expect(idle).toBe(`var(${SEGMENT_FILL_CSS_VAR.idle})`);
    expect(visited).not.toBe(idle);
  });

  it("keeps theme action fill for selected over visited", () => {
    const s = seg({ start_sec: 0, end_sec: 2 });
    const fill = waveformRegionFillColor(s, true, false, 2);
    expect(fill).toBe(`var(${SEGMENT_FILL_CSS_VAR.selected})`);
  });

  it("uses waveform in-selection fill token for secondary multi-select overlay", () => {
    const s = seg({ start_sec: 0, end_sec: 2 });
    const fill = waveformRegionFillColor(s, false, true, 0);
    expect(fill).toBe(`var(${SEGMENT_FILL_CSS_VAR.inSelectionWaveform})`);
  });

  it("uses uniform waveform in-selection fill when multiSelectActive", () => {
    const s = seg({ start_sec: 0, end_sec: 2 });
    const fill = waveformRegionFillColor(s, true, false, 0, { multiSelectActive: true });
    expect(fill).toBe(`var(${SEGMENT_FILL_CSS_VAR.inSelectionWaveform})`);
  });

  it("resolveWaveformSegmentFillState marks sparse multi-select secondaries as inSelection", () => {
    const state = resolveWaveformSegmentFillState({
      idx: 2,
      selectedIdx: 4,
      selectedIndices: new Set([0, 2, 4]),
    });
    expect(state.multiSelectActive).toBe(true);
    expect(state.selected).toBe(false);
    expect(state.inSelection).toBe(true);
  });

  it("resolveWaveformSegmentFillState downgrades primary to inSelection mix when multi-select", () => {
    const state = resolveWaveformSegmentFillState({
      idx: 4,
      selectedIdx: 4,
      selectedIndices: new Set([0, 2, 4]),
    });
    expect(state.selected).toBe(true);
    expect(state.inSelection).toBe(false);
    expect(state.multiSelectActive).toBe(true);
    const s = seg({ start_sec: 0, end_sec: 2 });
    expect(
      waveformRegionFillColor(s, state.selected, state.inSelection, undefined, {
        multiSelectActive: state.multiSelectActive,
      }),
    ).toBe(`var(${SEGMENT_FILL_CSS_VAR.inSelectionWaveform})`);
  });

  it("resolveWaveformSegmentFillState uses selection range when selectedIndices is empty", () => {
    const state = resolveWaveformSegmentFillState({
      idx: 3,
      selectedIdx: 5,
      selectionLo: 2,
      selectionHi: 5,
      selectionCount: 4,
    });
    expect(state.multiSelectActive).toBe(true);
    expect(state.inSelection).toBe(true);
  });
});
