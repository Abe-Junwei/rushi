import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWaveformAppliedZoomState, markAppliedPeaks } from "../utils/waveformAppliedZoom";
import { useWaveformZoomSync } from "./useWaveformZoomSync";
import { flushRaf, makeWs, zoomSyncBase } from "./useWaveformZoomSync.testHelpers";

describe("useWaveformZoomSync", () => {
  it("disables autoScroll and applies ws.zoom when no peak cache", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = createWaveformAppliedZoomState(56);

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          appliedZoom,
        }),
      { initialProps: { layoutPxPerSec: 56 } },
    );

    rerender({ layoutPxPerSec: 80 });
    await flushRaf();

    expect(appliedZoom.appliedZoomPxPerSecRef.current).toBe(80);
    expect(ws.setOptions).toHaveBeenCalledWith({ autoScroll: false });
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });

  it("calls onZoomApplied after zoom commit", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = createWaveformAppliedZoomState(56);
    const onZoomApplied = vi.fn();
    const onZoomAppliedRef = { current: onZoomApplied };

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          appliedZoom,
          onZoomAppliedRef,
        }),
      { initialProps: { layoutPxPerSec: 56 } },
    );

    rerender({ layoutPxPerSec: 80 });
    await flushRaf();

    expect(onZoomApplied).toHaveBeenCalledWith(80);
  });

  it("applies ws.zoom synchronously in layout effect without waiting for rAF", () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = createWaveformAppliedZoomState(56);

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          drawPxPerSec: 56,
          appliedZoom,
        }),
      { initialProps: { layoutPxPerSec: 56 } },
    );

    rerender({ layoutPxPerSec: 80 });

    expect(appliedZoom.appliedZoomPxPerSecRef.current).toBe(80);
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });

  it("ws.zoom follows layout while draw defers peaks load", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = createWaveformAppliedZoomState(56);
    markAppliedPeaks(appliedZoom, true, 56);
    const peakCache = {
      durationSec: 120,
      getWaveSurferPeaksAsync: vi.fn(),
    };

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number; drawPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          drawPxPerSec: props.drawPxPerSec,
          appliedZoom,
          peakCache: peakCache as never,
        }),
      { initialProps: { layoutPxPerSec: 56, drawPxPerSec: 56 } },
    );

    rerender({ layoutPxPerSec: 120, drawPxPerSec: 56 });
    await flushRaf();

    expect(ws.zoom).toHaveBeenCalledWith(120);
    expect(ws.load).not.toHaveBeenCalled();
  });
});
