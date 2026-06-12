import { describe, expect, it } from "vitest";
import { buildSegmentContextMenuItems, pointerTimeFromSegmentCard } from "./segmentContextMenuModel";
import type { SegmentDto } from "../tauri/projectApi";

function seg(start: number, end: number): SegmentDto {
  return { uid: "u1", idx: 0, start_sec: start, end_sec: end, text: "x" };
}

describe("pointerTimeFromSegmentCard", () => {
  it("maps card left/right to segment bounds", () => {
    const seg = { start_sec: 10, end_sec: 20 };
    const rect = { left: 100, width: 100 };
    expect(pointerTimeFromSegmentCard(100, rect, seg)).toBeCloseTo(10, 5);
    expect(pointerTimeFromSegmentCard(200, rect, seg)).toBeCloseTo(20, 5);
    expect(pointerTimeFromSegmentCard(150, rect, seg)).toBeCloseTo(15, 5);
  });

  it("segment list menu omits split at pointer", () => {
    const items = buildSegmentContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "segmentList",
    });
    expect(items.map((i) => i.key)).toEqual(["markFinalized", "delete", "mergePrev", "mergeNext"]);
  });

  it("waveform menu includes split at pointer when in range", () => {
    const items = buildSegmentContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "waveform",
    });
    expect(items.map((i) => i.key)).toContain("splitAtPointer");
  });

  it("split at pointer has no keyboard hint (Cmd+D is playhead split)", () => {
    const items = buildSegmentContextMenuItems({
      segmentIdx: 0,
      segments: [seg(0, 10)],
      busy: false,
      pointerTimeSec: 5,
      origin: "waveform",
    });
    const split = items.find((i) => i.key === "splitAtPointer");
    expect(split?.shortcutHint).toBeUndefined();
  });

  it("clamps clientX outside card", () => {
    const seg = { start_sec: 0, end_sec: 4 };
    const rect = { left: 50, width: 50 };
    expect(pointerTimeFromSegmentCard(0, rect, seg)).toBe(0);
    expect(pointerTimeFromSegmentCard(500, rect, seg)).toBe(4);
  });

  it("builds multi-select menu items", () => {
    const items = buildSegmentContextMenuItems({
      segmentIdx: 2,
      segments: [seg(0, 1), seg(1, 2), seg(2, 3), seg(3, 4)],
      busy: false,
      pointerTimeSec: 2.5,
      origin: "segmentList",
      selectionLo: 1,
      selectionHi: 3,
      selectionCount: 3,
    });
    expect(items.map((i) => i.key)).toEqual(["markFinalized", "mergeRange", "delete"]);
    expect(items.find((i) => i.key === "delete")?.label).toBe("删除 3 条语段");
  });
});
