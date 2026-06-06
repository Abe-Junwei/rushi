import { describe, expect, it } from "vitest";
import {
  CORRECTION_RULES_EMPTY_STATIC_BODY_PX,
  FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
  FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX,
  resolveCorrectionRulesEmptyFitHeight,
  resolveFloatingPanelFitHeight,
  resolveFloatingPanelSegmentListHeight,
  resolveStageBConsentFitHeight,
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

  it("compact fit height stays below preview default", () => {
    const empty = resolveCorrectionRulesEmptyFitHeight({
      hasReadOnlyHints: true,
      postTranscribeExtra: false,
    });
    const preview = resolveFloatingPanelFitHeight(CORRECTION_RULES_EMPTY_STATIC_BODY_PX, 5);
    expect(empty).toBeLessThan(preview);
    expect(empty).toBeLessThan(320);
  });

  it("stage B consent grows with pending hint", () => {
    const base = resolveStageBConsentFitHeight(false);
    const withHint = resolveStageBConsentFitHeight(true);
    expect(withHint).toBeGreaterThan(base);
  });

  it("empty fit height grows with lexicon health panel", () => {
    const base = resolveCorrectionRulesEmptyFitHeight({
      hasReadOnlyHints: false,
      postTranscribeExtra: false,
      lexiconHealthLineCount: 0,
    });
    const withHealth = resolveCorrectionRulesEmptyFitHeight({
      hasReadOnlyHints: false,
      postTranscribeExtra: false,
      lexiconHealthLineCount: 3,
      lexiconHealthExpanded: true,
    });
    expect(withHealth).toBeGreaterThan(base);
    expect(withHealth).toBeGreaterThanOrEqual(320);
  });
});
