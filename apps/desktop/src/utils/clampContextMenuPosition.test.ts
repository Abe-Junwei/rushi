import { describe, expect, it } from "vitest";
import { clampContextMenuPosition, estimateContextMenuSize } from "./clampContextMenuPosition";

describe("clampContextMenuPosition", () => {
  it("anchors near cursor with small offset", () => {
    const pos = clampContextMenuPosition(100, 200, 180, 140);
    expect(pos.left).toBe(102);
    expect(pos.top).toBe(202);
  });

  it("clamps top when menu overflows viewport bottom", () => {
    const vh = window.innerHeight;
    const menuH = 120;
    const clickY = vh - 20;
    const pos = clampContextMenuPosition(100, clickY, 180, menuH);
    expect(pos.top).toBeLessThanOrEqual(clickY + 2);
    expect(pos.top + menuH).toBeLessThanOrEqual(vh);
  });
});

describe("estimateContextMenuSize", () => {
  it("scales with item count", () => {
    expect(estimateContextMenuSize(4).height).toBeGreaterThan(estimateContextMenuSize(1).height);
  });
});
