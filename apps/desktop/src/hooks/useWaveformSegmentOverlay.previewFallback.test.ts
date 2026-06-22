// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { readCspLayoutRulesForElement } from "../utils/cspElementLayout";
import {
  applySegmentDraftOverlayImperative,
  applySegmentDraftPreviewFallback,
  clearSegmentDraftOverlayLayout,
  hideSegmentDraftPreviewFallbackIfOverlayMounted,
} from "../utils/waveformSegmentOverlayDraftChrome";

describe("useWaveformSegmentOverlay preview fallback", () => {
  it("paints a synchronous selected strip when the target overlay node is not mounted", () => {
    const previewEl = document.createElement("div");

    applySegmentDraftPreviewFallback(
      { idx: 1, startSec: 2, endSec: 3 },
      {
        segments: [
          { idx: 0, start_sec: 0, end_sec: 1, text: "a" },
          { idx: 1, start_sec: 2, end_sec: 3, text: "b" },
        ],
        timelineWidthPx: 1000,
        durationSec: 10,
        layoutHeightPx: 200,
        laneByIndex: [0, 1],
        laneCount: 2,
      },
      previewEl,
    );

    const rules = readCspLayoutRulesForElement(previewEl) ?? "";
    expect(rules).toContain("display: block");
    expect(rules).toContain("left: 200px");
    expect(rules).toContain("width: 100px");
    expect(rules).toContain("background:");
  });

  it("hides the fallback before paint once the real overlay node is mounted", () => {
    const overlay = document.createElement("div");
    overlay.className = "waveform-segment-overlay";
    const previewEl = document.createElement("div");
    overlay.appendChild(previewEl);
    setCspLayoutRules(previewEl, { display: "block", left: 100, width: 20 });

    const mounted = document.createElement("div");
    mounted.dataset.segmentIdx = "2";
    overlay.insertBefore(mounted, previewEl);

    expect(hideSegmentDraftPreviewFallbackIfOverlayMounted(previewEl, 2)).toBe(true);
    expect(readCspLayoutRulesForElement(previewEl)).toContain("display: none");
  });

  it("clears draft layout without removing selection chrome background", () => {
    const overlay = document.createElement("div");
    const mounted = document.createElement("div");
    mounted.dataset.segmentIdx = "1";
    overlay.appendChild(mounted);
    setCspLayoutRules(mounted, { background: "rgba(1, 2, 3, 0.2)" });

    expect(
      applySegmentDraftOverlayImperative(
        { idx: 1, startSec: 2, endSec: 3 },
        {
          segments: [
            { idx: 0, start_sec: 0, end_sec: 1, text: "a" },
            { idx: 1, start_sec: 2, end_sec: 3, text: "b" },
          ],
          timelineWidthPx: 1000,
          durationSec: 10,
          layoutHeightPx: 200,
          laneByIndex: [0, 0],
          laneCount: 1,
        },
        overlay,
      ),
    ).toBe(true);
    expect(readCspLayoutRulesForElement(mounted)).toContain("left: 200px");

    clearSegmentDraftOverlayLayout(1, overlay);

    const rules = readCspLayoutRulesForElement(mounted) ?? "";
    expect(rules).not.toContain("left:");
    expect(rules).not.toContain("width:");
    expect(rules).toContain("background: rgba(1, 2, 3, 0.2)");
  });
});
