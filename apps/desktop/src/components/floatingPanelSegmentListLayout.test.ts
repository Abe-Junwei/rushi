import { describe, expect, it } from "vitest";
import {
  FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
  FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX,
  resolveFloatingPanelFitHeight,
  resolveFloatingPanelSegmentListHeight,
} from "./floatingPanelSegmentListLayout";

describe("floatingPanelSegmentListLayout", () => {
  it("grows list height with row count until cap", () => {
    expect(resolveFloatingPanelSegmentListHeight(0)).toBe(0);
    expect(resolveFloatingPanelSegmentListHeight(1)).toBe(FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX);
    expect(resolveFloatingPanelSegmentListHeight(8)).toBe(8 * FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX);
    expect(resolveFloatingPanelSegmentListHeight(20)).toBe(FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX);
  });

  it("includes static chrome in panel fit height", () => {
    const staticBody = 200;
    const rows = 3;
    const list = resolveFloatingPanelSegmentListHeight(rows);
    expect(resolveFloatingPanelFitHeight(staticBody, rows)).toBeGreaterThan(staticBody + list);
  });
});
