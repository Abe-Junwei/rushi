import { describe, expect, it } from "vitest";
import {
  mergeContentFitHeights,
  resolveDetailsSectionHeight,
  resolveFloatingPanelSectionsFitHeight,
  resolveMeasuredPanelFitHeight,
  resolveMeasuredPanelFitHeightFromBox,
} from "./floatingPanelFitSections";
import { FLOATING_PANEL_TITLE_BAR_PX } from "./floatingPanelSegmentListLayout";

describe("floatingPanelFitSections", () => {
  it("resolveDetailsSectionHeight returns summary only when collapsed", () => {
    expect(resolveDetailsSectionHeight({ lineCount: 3, expanded: false })).toBeGreaterThan(0);
    const collapsed = resolveDetailsSectionHeight({ lineCount: 3, expanded: false });
    const expanded = resolveDetailsSectionHeight({ lineCount: 3, expanded: true });
    expect(expanded).toBeGreaterThan(collapsed);
  });

  it("resolveFloatingPanelSectionsFitHeight includes title bar", () => {
    const height = resolveFloatingPanelSectionsFitHeight([{ kind: "static", px: 100 }]);
    expect(height).toBe(FLOATING_PANEL_TITLE_BAR_PX + 100);
  });

  it("mergeContentFitHeights grows when measured exceeds estimate", () => {
    expect(mergeContentFitHeights(300, 360)).toBe(360);
    expect(mergeContentFitHeights(undefined, 280)).toBe(280);
    expect(mergeContentFitHeights(400, null)).toBe(400);
  });

  it("mergeContentFitHeights prefers estimate unless measured panel is taller", () => {
    expect(mergeContentFitHeights(300, 280)).toBe(300);
    expect(mergeContentFitHeights(280, 320)).toBe(320);
  });

  it("resolveMeasuredPanelFitHeight adds shell chrome", () => {
    expect(resolveMeasuredPanelFitHeight(200)).toBeGreaterThan(200 + FLOATING_PANEL_TITLE_BAR_PX);
  });

  it("resolveMeasuredPanelFitHeightFromBox adds title bar only", () => {
    expect(resolveMeasuredPanelFitHeightFromBox(360)).toBe(FLOATING_PANEL_TITLE_BAR_PX + 360);
  });
});
