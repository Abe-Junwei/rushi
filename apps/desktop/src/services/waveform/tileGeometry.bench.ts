import { bench, describe } from "vitest";
import { computeTileLayout } from "./tileGeometry";

describe("computeTileLayout", () => {
  bench("fit-all on 20min audio (timeline < viewport)", () => {
    computeTileLayout({
      timelineWidthPx: 670,
      viewportWidthPx: 1600,
      scrollLeftPx: 0,
      barWidth: 2,
      barGap: 1,
      overscanTiles: 5,
    });
  });

  bench("high zoom on 20min audio (mid-scroll)", () => {
    computeTileLayout({
      timelineWidthPx: 66_920,
      viewportWidthPx: 1600,
      scrollLeftPx: 40_000,
      barWidth: 2,
      barGap: 1,
      overscanTiles: 5,
    });
  });

  bench("default zoom on 1min audio", () => {
    computeTileLayout({
      timelineWidthPx: 56_000,
      viewportWidthPx: 1600,
      scrollLeftPx: 0,
      barWidth: 2,
      barGap: 1,
      overscanTiles: 5,
    });
  });
});
