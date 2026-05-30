import { describe, expect, it } from "vitest";
import {
  computeFitSelectionPxPerSec,
  computeTimelineWidthPx,
  resolveViewportFitLayoutPxPerSec,
} from "../utils/pxPerSec";
import { resolveViewportFitScrollPx } from "./useTranscriptionViewportFit";

describe("viewport fit layout px alignment", () => {
  it("uses render-capped px for pending scroll after layout clamp", () => {
    const dur = 4 * 3600;
    const w = 800;
    const raw = computeFitSelectionPxPerSec(w, 10, 10.5);
    const layoutPx = resolveViewportFitLayoutPxPerSec(raw, dur);
    expect(layoutPx).toBeLessThan(raw);

    const pending = {
      intent: { startSec: 20, endSec: 28 },
      pxPerSec: layoutPx,
    };
    const tw = computeTimelineWidthPx(dur, layoutPx);
    const scroll = resolveViewportFitScrollPx({
      pending,
      durationSec: dur,
      viewportWidthPx: w,
    });
    const segStartPx = (20 / dur) * tw;
    const segWidthPx = (8 / dur) * tw;
    expect(scroll).toBeCloseTo(segStartPx - (w - segWidthPx) / 2, 4);
  });
});
