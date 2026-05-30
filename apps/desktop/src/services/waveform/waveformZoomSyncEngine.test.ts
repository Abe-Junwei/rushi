import { describe, expect, it } from "vitest";
import { createWaveformAppliedZoomState, markAppliedPeaks, markAppliedZoomWs } from "../../utils/waveformAppliedZoom";
import { planWaveformZoomApply } from "./waveformZoomSyncEngine";

const peakCache = { durationSec: 120 } as never;

describe("planWaveformZoomApply", () => {
  it("returns finish-zoom when no peak cache", () => {
    const appliedZoom = createWaveformAppliedZoomState(56);
    expect(
      planWaveformZoomApply({
        intentPxPerSec: 80,
        appliedZoom,
        peakCache: null,
        mediaUrl: "asset://a.mp3",
        layoutDurationSec: 120,
        isPlaying: false,
        hotSwitchWhilePlaying: true,
        peaksLoadInFlight: false,
        viewportResizeHold: false,
      }),
    ).toEqual({ type: "finish-zoom" });
  });

  it("returns noop when peaks and zoom already match intent", () => {
    const appliedZoom = createWaveformAppliedZoomState(80);
    markAppliedPeaks(appliedZoom, true, 80);
    expect(
      planWaveformZoomApply({
        intentPxPerSec: 80,
        appliedZoom,
        peakCache,
        mediaUrl: "asset://a.mp3",
        layoutDurationSec: 120,
        peakCacheDurationSec: 120,
        isPlaying: false,
        hotSwitchWhilePlaying: true,
        peaksLoadInFlight: false,
        viewportResizeHold: false,
      }),
    ).toEqual({ type: "noop" });
  });

  it("returns finish-zoom for sub-min fit-all refit within loaded peaks tier", () => {
    const appliedZoom = createWaveformAppliedZoomState(0.083);
    markAppliedPeaks(appliedZoom, true, 0.083);
    expect(
      planWaveformZoomApply({
        intentPxPerSec: 0.133,
        appliedZoom,
        peakCache,
        mediaUrl: "asset://a.mp3",
        layoutDurationSec: 14429,
        peakCacheDurationSec: 14429,
        isPlaying: false,
        hotSwitchWhilePlaying: true,
        peaksLoadInFlight: false,
        viewportResizeHold: false,
      }),
    ).toEqual({ type: "finish-zoom" });
  });

  it("defers peaks load while playing when hot-switch disabled", () => {
    const appliedZoom = createWaveformAppliedZoomState(56);
    expect(
      planWaveformZoomApply({
        intentPxPerSec: 80,
        appliedZoom,
        peakCache,
        mediaUrl: "asset://a.mp3",
        layoutDurationSec: 120,
        peakCacheDurationSec: 120,
        isPlaying: true,
        hotSwitchWhilePlaying: false,
        peaksLoadInFlight: false,
        viewportResizeHold: false,
      }),
    ).toEqual({ type: "defer-hot-switch" });
  });

  it("defers peaks load during viewport resize hold", () => {
    const appliedZoom = createWaveformAppliedZoomState(56);
    expect(
      planWaveformZoomApply({
        intentPxPerSec: 80,
        appliedZoom,
        peakCache,
        mediaUrl: "asset://a.mp3",
        layoutDurationSec: 120,
        peakCacheDurationSec: 120,
        isPlaying: false,
        hotSwitchWhilePlaying: true,
        peaksLoadInFlight: false,
        viewportResizeHold: true,
      }),
    ).toEqual({ type: "defer-resize-load", loadPeaksPx: 80, layoutDur: 120 });
  });

  it("returns load-peaks when quantum bucket changes", () => {
    const appliedZoom = createWaveformAppliedZoomState(56);
    markAppliedPeaks(appliedZoom, true, 56);
    markAppliedZoomWs(appliedZoom, 56);
    expect(
      planWaveformZoomApply({
        intentPxPerSec: 120,
        appliedZoom,
        peakCache,
        mediaUrl: "asset://a.mp3",
        layoutDurationSec: 120,
        peakCacheDurationSec: 120,
        isPlaying: false,
        hotSwitchWhilePlaying: true,
        peaksLoadInFlight: false,
        viewportResizeHold: false,
      }),
    ).toEqual({ type: "load-peaks", loadPeaksPx: 120, layoutDur: 120 });
  });
});
