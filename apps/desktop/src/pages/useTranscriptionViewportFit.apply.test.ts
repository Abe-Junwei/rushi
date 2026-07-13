import { describe, expect, it } from "vitest";
import {
  computeFitSelectionPxPerSec,
  computeTimelineWidthPx,
  resolveViewportFitLayoutPxPerSec,
} from "../utils/pxPerSec";
import { resolveViewportFitScrollPx } from "./useTranscriptionViewportFit";

describe("viewport fit layout px alignment", () => {
  it("uses layout-capped px for pending scroll after layout clamp", () => {
    const dur = 4 * 3600;
    const w = 800;
    const raw = computeFitSelectionPxPerSec(w, 10, 10.5);
    const layoutPx = resolveViewportFitLayoutPxPerSec(raw, dur);
    expect(layoutPx).toBeLessThan(raw);

    // Mid-file segment so the centered scroll is positive (unclamped) and its value
    // depends on the layout-capped tw — verifying layoutPx (not raw) feeds the scroll.
    const segStartSec = dur / 2;
    const segEndSec = segStartSec + 8;
    const pending = {
      intent: { startSec: segStartSec, endSec: segEndSec },
      pxPerSec: layoutPx,
    };
    const tw = computeTimelineWidthPx(dur, layoutPx);
    const scroll = resolveViewportFitScrollPx({
      pending,
      durationSec: dur,
      viewportWidthPx: w,
    });
    const segStartPx = (segStartSec / dur) * tw;
    const segWidthPx = (8 / dur) * tw;
    const maxSl = Math.max(0, tw - w);
    const targetSl = segStartPx - (w - segWidthPx) / 2;
    expect(scroll).toBeCloseTo(Math.max(0, Math.min(maxSl, targetSl)), 4);
  });
});
