import { describe, expect, it } from "vitest";
import { effectiveTimelinePxPerSec } from "./waveformProjection";
import { TIMELINE_PX_PER_SEC, MAX_WAVESURFER_PEAK_COLUMNS } from "./pxPerSec";
import {
  resolveLayoutDurationSec,
  resolveMediaDurationSec,
  resolveWaveformTimelineMetrics,
} from "./waveformTimelineMetrics";

describe("resolveMediaDurationSec", () => {
  it("prefers WS duration when both are known", () => {
    expect(
      resolveMediaDurationSec({ wsDurationSec: 120.5, peaksStatusDurationSec: 118 }),
    ).toBe(120.5);
  });

  it("falls back to peaks manifest before WS ready", () => {
    expect(resolveMediaDurationSec({ wsDurationSec: 0, peaksStatusDurationSec: 600 })).toBe(600);
  });

  it("returns 0 when neither source is known", () => {
    expect(resolveMediaDurationSec({ wsDurationSec: 0, peaksStatusDurationSec: 0 })).toBe(0);
  });
});

describe("resolveLayoutDurationSec", () => {
  it("prefers synced layout ref over WS and peaks", () => {
    expect(
      resolveLayoutDurationSec({
        layoutDurationSecRef: 1263,
        wsDurationSec: 1260,
        peaksStatusDurationSec: 1250,
      }),
    ).toBe(1263);
  });

  it("falls back to merged WS and peaks when ref is unset", () => {
    expect(
      resolveLayoutDurationSec({
        wsDurationSec: 0,
        peaksStatusDurationSec: 600,
      }),
    ).toBe(600);
  });

  it("uses layoutDurationSec prop before WS when ref is unset", () => {
    expect(
      resolveLayoutDurationSec({
        layoutDurationSec: 798,
        wsDurationSec: 800,
      }),
    ).toBe(798);
  });
});

describe("resolveWaveformTimelineMetrics", () => {
  it("exports timeline width from one px/s input", () => {
    const m = resolveWaveformTimelineMetrics({
      wsDurationSec: 1263,
      peaksStatusDurationSec: 1260,
      pxPerSec: 0.05,
    });

    expect(m.mediaDurationSec).toBe(1263);
    expect(m.timelineWidthPx).toBe(Math.ceil(1263 * 0.05));
    expect(effectiveTimelinePxPerSec(m.timelineWidthPx, m.mediaDurationSec)).toBeCloseTo(
      m.timelineWidthPx / 1263,
      6,
    );
  });

  it("uses default px/s for short clips", () => {
    const m = resolveWaveformTimelineMetrics({
      wsDurationSec: 100,
      peaksStatusDurationSec: 100,
      pxPerSec: TIMELINE_PX_PER_SEC,
    });

    expect(m.timelineWidthPx).toBe(5600);
  });

  it("caps timeline width to peaks column budget (release peaks path)", () => {
    const m = resolveWaveformTimelineMetrics({
      wsDurationSec: 360,
      peaksStatusDurationSec: 360,
      pxPerSec: 100,
    });

    expect(m.timelineWidthPx).toBeLessThanOrEqual(MAX_WAVESURFER_PEAK_COLUMNS);
    expect(m.timelineWidthPx).toBeGreaterThan(32_000);
  });
});
