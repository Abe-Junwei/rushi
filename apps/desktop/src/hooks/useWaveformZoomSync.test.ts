import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWaveformZoomSync } from "./useWaveformZoomSync";

async function flushRaf() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function makeWs(overrides: Record<string, unknown> = {}) {
  return {
    setOptions: vi.fn(),
    zoom: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    isPlaying: vi.fn(() => false),
    getCurrentTime: vi.fn(() => 0),
    setTime: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const hotSwitchWhilePlayingRef = { current: true };

const zoomSyncBase = {
  isReady: true,
  isPlaying: false,
  mediaUrl: "asset://audio.mp3",
  hotSwitchWhilePlayingRef,
  hotSwitchWhilePlaying: true,
} as const;

describe("useWaveformZoomSync", () => {
  it("disables autoScroll and applies ws.zoom when no peak cache", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });
    await flushRaf();

    expect(appliedZoomPxPerSecRef.current).toBe(80);
    expect(ws.setOptions).toHaveBeenCalledWith({ autoScroll: false });
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });

  it("calls onZoomApplied after zoom commit", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const onZoomApplied = vi.fn();
    const onZoomAppliedRef = { current: onZoomApplied };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          onZoomAppliedRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });
    await flushRaf();

    expect(onZoomApplied).toHaveBeenCalledWith(80);
  });

  it("loads peaks via ws.load when peak cache is available", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const appliedPeaksLoadPxPerSecRef = { current: Number.NaN };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 120 }),
    };
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        minPxPerSec: 80,
        appliedZoomPxPerSecRef,
        appliedPeaksRef,
        appliedPeaksLoadPxPerSecRef,
        peakCache: peakCache as never,
        peakCacheRef,
        layoutDurationSecRef,
      }),
    );

    await flushRaf();
    await Promise.resolve();

    expect(ws.setOptions).toHaveBeenCalledWith({ autoScroll: false });
    expect(peakCache.getWaveSurferPeaksAsync).toHaveBeenCalledWith(80, 120);
    expect(ws.load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1]], 120);
    expect(appliedPeaksRef.current).toBe(true);
    expect(appliedPeaksLoadPxPerSecRef.current).toBe(80);
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });

  it("defers peaks hot-switch while playing and retries after pause", async () => {
    const ws = makeWs({ isPlaying: vi.fn(() => true) });
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const appliedPeaksLoadPxPerSecRef = { current: Number.NaN };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 120 }),
    };
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
          minPxPerSec: 80,
          appliedZoomPxPerSecRef,
          appliedPeaksRef,
          appliedPeaksLoadPxPerSecRef,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        });
      },
      { initialProps: { isPlaying: true } },
    );

    await flushRaf();
    await Promise.resolve();

    expect(ws.load).not.toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(80);

    (ws.isPlaying as ReturnType<typeof vi.fn>).mockReturnValue(false);
    rerender({ isPlaying: false });
    await flushRaf();
    await Promise.resolve();

    expect(ws.load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1]], 120);
    expect(appliedPeaksRef.current).toBe(true);
  });

  it("preserves playhead time when loading peaks", async () => {
    const ws = makeWs({ getCurrentTime: vi.fn(() => 42) });
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const appliedPeaksLoadPxPerSecRef = { current: Number.NaN };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 120 }),
    };
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        minPxPerSec: 80,
        appliedZoomPxPerSecRef,
        appliedPeaksRef,
        appliedPeaksLoadPxPerSecRef,
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

  it("sub-min viewport refit before peaks applied still allows ws.load", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 0.083 };
    const appliedPeaksRef = { current: false };
    const appliedPeaksLoadPxPerSecRef = { current: Number.NaN };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 1249 }),
    };
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 1249 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          appliedPeaksRef,
          appliedPeaksLoadPxPerSecRef,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { minPxPerSec: 0.083 } },
    );

    await Promise.resolve();

    ws.load.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();

    rerender({ minPxPerSec: 0.133 });
    await Promise.resolve();

    expect(peakCache.getWaveSurferPeaksAsync).toHaveBeenCalledWith(0.133, 1249);
    expect(ws.load).toHaveBeenCalled();
  });

  it("loads peaks when entering sub-min fit-all from manual zoom on decode", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const appliedPeaksLoadPxPerSecRef = { current: Number.NaN };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 1249 }),
    };
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 1249 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          appliedPeaksRef,
          appliedPeaksLoadPxPerSecRef,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    await Promise.resolve();

    ws.load.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();

    rerender({ minPxPerSec: 0.96 });
    await Promise.resolve();
    await Promise.resolve();

    expect(peakCache.getWaveSurferPeaksAsync).toHaveBeenCalledWith(0.96, 1249);
    expect(ws.load).toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(0.96);
  });

  it("zooms only within sub-min fit-all without ws.load (viewport refit)", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 0.083 };
    const appliedPeaksRef = { current: true };
    const appliedPeaksLoadPxPerSecRef = { current: 0.083 };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 14429 }),
    };
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 14429 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          appliedPeaksRef,
          appliedPeaksLoadPxPerSecRef,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { minPxPerSec: 0.083 } },
    );

    await flushRaf();
    await Promise.resolve();

    ws.load.mockClear();
    ws.zoom.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();

    rerender({ minPxPerSec: 0.133 });
    await flushRaf();
    await Promise.resolve();

    expect(ws.load).not.toHaveBeenCalled();
    expect(peakCache.getWaveSurferPeaksAsync).not.toHaveBeenCalled();
    expect(appliedPeaksLoadPxPerSecRef.current).toBe(0.083);
  });

  it("zooms only within the same peaks quantum bucket", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const appliedPeaksLoadPxPerSecRef = { current: Number.NaN };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 120 }),
    };
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          appliedPeaksRef,
          appliedPeaksLoadPxPerSecRef,
          peakCache: peakCache as never,
          peakCacheRef,
          layoutDurationSecRef,
        }),
      { initialProps: { minPxPerSec: 57 } },
    );

    await flushRaf();
    await Promise.resolve();
    ws.load.mockClear();
    peakCache.getWaveSurferPeaksAsync.mockClear();

    rerender({ minPxPerSec: 59 });
    await flushRaf();
    await Promise.resolve();

    expect(ws.load).not.toHaveBeenCalled();
    expect(peakCache.getWaveSurferPeaksAsync).not.toHaveBeenCalled();
    expect(ws.zoom).toHaveBeenCalledWith(59);
    expect(appliedPeaksLoadPxPerSecRef.current).toBe(56);
  });

  it("defers ws.load while viewport resize hold is active, flushes after hold clears", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const appliedPeaksLoadPxPerSecRef = { current: Number.NaN };
    const viewportResizeHoldRef = { current: true };
    const flushDeferredPeaksLoadRef = { current: undefined as (() => void) | undefined };
    const peakCache = {
      getWaveSurferPeaksAsync: vi.fn().mockResolvedValue({ peaks: [[0, 1]], duration: 120 }),
    };
    const peakCacheRef = { current: peakCache as never };
    const layoutDurationSecRef = { current: 120 };

    renderHook(() =>
      useWaveformZoomSync({
        ...zoomSyncBase,
        wsRef,
        minPxPerSec: 80,
        appliedZoomPxPerSecRef,
        appliedPeaksRef,
        appliedPeaksLoadPxPerSecRef,
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
    await Promise.resolve();

    expect(peakCache.getWaveSurferPeaksAsync).toHaveBeenCalledWith(80, 120);
    expect(ws.load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1]], 120);
  });

  it("applies ws.zoom synchronously in layout effect without waiting for rAF", () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });

    expect(appliedZoomPxPerSecRef.current).toBe(80);
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });
});
