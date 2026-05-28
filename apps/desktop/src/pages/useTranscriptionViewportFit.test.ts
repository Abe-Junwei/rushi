import { describe, expect, it } from "vitest";
import { resolveViewportFitScrollPx } from "./useTranscriptionViewportFit";

describe("resolveViewportFitScrollPx", () => {
  it("centers selected segment after zoom", () => {
    const px = 100;
    const scroll = resolveViewportFitScrollPx({
      pending: {
        intent: { startSec: 10, endSec: 12 },
        pxPerSec: px,
      },
      durationSec: 120,
      viewportWidthPx: 800,
    });
    const tw = Math.max(Math.ceil(120 * px), 320);
    expect(scroll).toBe(10 * px - (800 - 2 * px) / 2);
    expect(scroll).toBeGreaterThanOrEqual(0);
    expect(scroll).toBeLessThanOrEqual(Math.max(0, tw - 800));
  });
});
