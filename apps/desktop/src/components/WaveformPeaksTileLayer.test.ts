import { describe, expect, it } from "vitest";
import { PeakCache } from "../services/waveform/PeakCache";
import {
  peakCacheIdentity,
  waveformTileDrawSignature,
} from "../services/waveform/waveformTileDrawSignature";

describe("WaveformPeaksTileLayer draw signature", () => {
  it("includes peak cache identity so file switches invalidate skip", () => {
    const cacheA = { durationSec: 120, sampleRate: 44100 } as PeakCache;
    const cacheB = { durationSec: 120, sampleRate: 48000 } as PeakCache;

    const base = {
      generation: 1,
      leftPx: 0,
      widthPx: 4096,
      heightPx: 96,
      layoutTimelineWidthPx: 8000,
      drawTimelineWidthPx: 8000,
      mediaDurationSec: 120,
      dpr: 2,
      drawPxPerSec: 56,
    };

    expect(peakCacheIdentity(cacheA)).not.toBe(peakCacheIdentity(cacheB));
    expect(waveformTileDrawSignature({ ...base, peakCache: cacheA })).not.toBe(
      waveformTileDrawSignature({ ...base, peakCache: cacheB }),
    );
  });

  it("includes layoutTimelineWidthPx so media load / zoom preview invalidates skip", () => {
    const cache = { durationSec: 10, sampleRate: 44100 } as PeakCache;
    const base = {
      generation: 1,
      leftPx: 0,
      widthPx: 4096,
      heightPx: 96,
      drawTimelineWidthPx: 560,
      mediaDurationSec: 10,
      dpr: 2,
      drawPxPerSec: 56,
      peakCache: cache,
    };

    const narrow = waveformTileDrawSignature({ ...base, layoutTimelineWidthPx: 560 });
    const wide = waveformTileDrawSignature({ ...base, layoutTimelineWidthPx: 900 });
    expect(narrow).not.toBe(wide);
  });

  it("includes mediaDurationSec when layout expands after WaveSurfer ready", () => {
    const cache = { durationSec: 732, sampleRate: 44100 } as PeakCache;
    const base = {
      generation: 1,
      leftPx: 40950,
      widthPx: 4095,
      heightPx: 96,
      layoutTimelineWidthPx: 66_920,
      drawTimelineWidthPx: 66_920,
      dpr: 2,
      drawPxPerSec: 56,
      peakCache: cache,
    };

    expect(
      waveformTileDrawSignature({ ...base, mediaDurationSec: 732 }),
    ).not.toBe(waveformTileDrawSignature({ ...base, mediaDurationSec: 1195 }));
  });

  it("includes dpr so backing-store resize always redraws", () => {
    const cache = { durationSec: 10, sampleRate: 44100 } as PeakCache;
    const base = {
      generation: 1,
      leftPx: 0,
      widthPx: 4096,
      heightPx: 96,
      layoutTimelineWidthPx: 560,
      drawTimelineWidthPx: 560,
      mediaDurationSec: 10,
      drawPxPerSec: 56,
      peakCache: cache,
    };

    expect(waveformTileDrawSignature({ ...base, dpr: 1 })).not.toBe(
      waveformTileDrawSignature({ ...base, dpr: 2 }),
    );
  });
});
