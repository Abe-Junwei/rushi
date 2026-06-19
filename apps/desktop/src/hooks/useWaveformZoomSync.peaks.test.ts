import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWaveformZoomSync } from "./useWaveformZoomSync";
import {
  flushRaf,
  makeAppliedZoom,
  makePeakCacheMock,
  makeWs,
  zoomSyncBase,
} from "./useWaveformZoomSync.testHelpers";

async function flushPeaksLoad() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useWaveformZoomSync peaks", () => {
  it("applies ws.zoom synchronously before async peaks load resolves", async () => {
    let resolveLoad: (() => void) | undefined;
    const ws = makeWs({
      load: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    });
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56);
    const peakCache = makePeakCacheMock();
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        layoutPxPerSec: 80,
        drawPxPerSec: 80,
        appliedZoom,
        peakCache: peakCache as never,
        peakCacheRef,
        layoutDurationSecRef,
      }),
    );

    expect(ws.zoom).toHaveBeenCalledWith(80);
    expect(ws.load).not.toHaveBeenCalled();
    await flushPeaksLoad();
    expect(ws.load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1]], 120);

    resolveLoad!();
    await flushPeaksLoad();
  });

  it("loads peaks via ws.load when peak cache is available", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56);
    const peakCache = makePeakCacheMock();
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        layoutPxPerSec: 80,
        appliedZoom,
        peakCache: peakCache as never,
        peakCacheRef,
        layoutDurationSecRef,
      }),
    );

    await flushRaf();
    await flushPeaksLoad();

    expect(ws.setOptions).toHaveBeenCalledWith({ autoScroll: false });
    expect(peakCache.getWaveSurferPeaksAsync).toHaveBeenCalledWith(80, 120);
    expect(ws.load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1]], 120);
    expect(appliedZoom.appliedPeaksRef.current).toBe(true);
    expect(appliedZoom.appliedPeaksLoadPxPerSecRef.current).toBe(80);
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });

  it("defers peaks hot-switch while playing and retries after pause", async () => {
    const ws = makeWs({ isPlaying: vi.fn(() => true) });
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56);
    const peakCache = makePeakCacheMock();
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    const { rerender } = renderHook(
      (props: { isPlaying: boolean }) => {
        const deferHotSwitchRef = { current: false };
        return useWaveformZoomSync({
          ...zoomSyncBase,
          hotSwitchWhilePlayingRef: deferHotSwitchRef,
          hotSwitchWhilePlaying: false,
          isPlaying: props.isPlaying,
          wsRef,
          layoutPxPerSec: 80,
          appliedZoom,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        });
      },
      { initialProps: { isPlaying: true } },
    );

    await flushRaf();
    await flushPeaksLoad();

    expect(ws.load).not.toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(80);

    (ws.isPlaying as ReturnType<typeof vi.fn>).mockReturnValue(false);
    rerender({ isPlaying: false });
    await flushRaf();
    await flushPeaksLoad();

    expect(ws.load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1]], 120);
    expect(appliedZoom.appliedPeaksRef.current).toBe(true);
  });

  it("preserves playhead time when loading peaks", async () => {
    const ws = makeWs({ getCurrentTime: vi.fn(() => 42) });
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56);
    const peakCache = makePeakCacheMock();
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        layoutPxPerSec: 80,
        appliedZoom,
        peakCache: peakCache as never,
        peakCacheRef,
        layoutDurationSecRef,
      }),
    );

    await flushRaf();
    await Promise.resolve();

    expect(ws.getCurrentTime).toHaveBeenCalled();
    expect(ws.setTime).toHaveBeenCalledWith(42);
  });

  it("sub-min viewport refit zooms immediately without reloading sparse peaks tier", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(0.083, { applied: true, loadPx: 0.083 });
    const peakCache = makePeakCacheMock({ peaks: [[0, 1]], duration: 1249 });
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 1249 };

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          appliedZoom,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { layoutPxPerSec: 0.083 } },
    );

    await flushPeaksLoad();

    ws.load.mockClear();
    ws.zoom.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();

    rerender({ layoutPxPerSec: 0.133 });
    await Promise.resolve();

    expect(peakCache.getWaveSurferPeaksAsync).not.toHaveBeenCalled();
    expect(ws.load).not.toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(0.133);
  });

  it("zooms only when entering sub-min fit-all from manual zoom (stretch fallback)", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56, { applied: true, loadPx: 56 });
    const peakCache = makePeakCacheMock({ peaks: [[0, 1]], duration: 1249 });
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 1249 };

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          appliedZoom,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { layoutPxPerSec: 56 } },
    );

    await Promise.resolve();

    ws.load.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();
    ws.zoom.mockClear();

    rerender({ layoutPxPerSec: 0.96 });
    await Promise.resolve();

    expect(peakCache.getWaveSurferPeaksAsync).not.toHaveBeenCalled();
    expect(ws.load).not.toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(0.96);
  });

  it("loads peaks when crossing to a finer LOD tier", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56, { applied: true, loadPx: 56 });
    const peakCache = makePeakCacheMock();
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        layoutPxPerSec: 250,
        drawPxPerSec: 250,
        appliedZoom,
        peakCache: peakCache as never,
        peakCacheRef,
        layoutDurationSecRef,
      }),
    );

    await flushPeaksLoad();

    expect(peakCache.getWaveSurferPeaksAsync).toHaveBeenCalledWith(248, 120);
    expect(ws.load).toHaveBeenCalled();
  });

  it("zooms only within sub-min fit-all without ws.load (viewport refit)", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(0.083, { applied: true, loadPx: 0.083 });
    const peakCache = makePeakCacheMock({ peaks: [[0, 1]], duration: 14429 });
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 14429 };

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          appliedZoom,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { layoutPxPerSec: 0.083 } },
    );

    await flushRaf();
    await Promise.resolve();

    ws.load.mockClear();
    ws.zoom.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();

    rerender({ layoutPxPerSec: 0.133 });
    await flushRaf();
    await Promise.resolve();

    expect(ws.load).not.toHaveBeenCalled();
    expect(peakCache.getWaveSurferPeaksAsync).not.toHaveBeenCalled();
    expect(appliedZoom.appliedPeaksLoadPxPerSecRef.current).toBe(0.083);
  });

  it("zooms only within the same peaks quantum bucket", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56);
    const peakCache = makePeakCacheMock();
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    const { rerender } = renderHook(
      (props: { layoutPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          layoutPxPerSec: props.layoutPxPerSec,
          appliedZoom,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { layoutPxPerSec: 57 } },
    );

    await flushRaf();
    await Promise.resolve();
    ws.load.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();

    rerender({ layoutPxPerSec: 59 });
    await flushRaf();
    await Promise.resolve();

    expect(ws.load).not.toHaveBeenCalled();
    expect(peakCache.getWaveSurferPeaksAsync).not.toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(59);
    expect(appliedZoom.appliedPeaksLoadPxPerSecRef.current).toBe(56);
  });

  it("defers ws.load while viewport resize hold is active, flushes after hold clears", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = makeAppliedZoom(56);
    const viewportResizeHoldRef = { current: true };
    const flushDeferredPeaksLoadRef = { current: undefined as (() => void) | undefined };
    const peakCache = makePeakCacheMock();
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        layoutPxPerSec: 80,
        appliedZoom,
        peakCache: peakCache as never,
        peakCacheRef,
        layoutDurationSecRef,
        viewportResizeHoldRef,
        flushDeferredPeaksLoadRef,
      }),
    );

    expect(ws.load).not.toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(80);
    expect(typeof flushDeferredPeaksLoadRef.current).toBe("function");

    viewportResizeHoldRef.current = false;
    flushDeferredPeaksLoadRef.current?.();
    await flushPeaksLoad();

    expect(peakCache.getWaveSurferPeaksAsync).toHaveBeenCalledWith(80, 120);
    expect(ws.load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1]], 120);
  });
});
