import { describe, expect, it } from "vitest";
import { p1PointerTimeFromSegmentCard } from "./p1SegmentContextMenuModel";

describe("p1PointerTimeFromSegmentCard", () => {
  it("maps card left/right to segment bounds", () => {
    const seg = { start_sec: 10, end_sec: 20 };
    const rect = { left: 100, width: 100 };
    expect(p1PointerTimeFromSegmentCard(100, rect, seg)).toBeCloseTo(10, 5);
    expect(p1PointerTimeFromSegmentCard(200, rect, seg)).toBeCloseTo(20, 5);
    expect(p1PointerTimeFromSegmentCard(150, rect, seg)).toBeCloseTo(15, 5);
  });

  it("clamps clientX outside card", () => {
    const seg = { start_sec: 0, end_sec: 4 };
    const rect = { left: 50, width: 50 };
    expect(p1PointerTimeFromSegmentCard(0, rect, seg)).toBe(0);
    expect(p1PointerTimeFromSegmentCard(500, rect, seg)).toBe(4);
  });
});
