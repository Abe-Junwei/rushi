import { describe, expect, it } from "vitest";
import { syncWaveformScrollPinnedLayers } from "./waveformScrollPinnedLayers";

describe("syncWaveformScrollPinnedLayers", () => {
  it("applies translate3d(scrollLeft) to each layer", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    syncWaveformScrollPinnedLayers({ layers: [a, b, null], scrollLeftPx: 240 });
    expect(a.style.transform).toBe("translate3d(240px, 0, 0)");
    expect(b.style.transform).toBe("translate3d(240px, 0, 0)");
  });

  it("treats non-finite scroll as 0", () => {
    const el = document.createElement("div");
    syncWaveformScrollPinnedLayers({ layers: [el], scrollLeftPx: Number.NaN });
    expect(el.style.transform).toBe("translate3d(0px, 0, 0)");
  });
});
