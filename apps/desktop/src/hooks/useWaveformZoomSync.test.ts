import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWaveformZoomSync } from "./useWaveformZoomSync";

describe("useWaveformZoomSync", () => {
  it("calls ws.zoom synchronously in layout effect when minPxPerSec changes", () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 10);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    expect(zoom).not.toHaveBeenCalled();

    rerender({ minPxPerSec: 112 });

    expect(zoom).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledWith(112);
    expect(appliedZoomPxPerSecRef.current).toBe(112);
  });

  it("uses peaks resample + ws.load instead of ws.zoom when PeakCache is available", () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 10);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const peakCache = {
      getWaveSurferPeaks: vi.fn(() => ({
        peaks: [[0, 1, 0, 0.5]],
        duration: 10,
      })),
    };
    const peakCacheRef = { current: peakCache as never };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          peakCacheRef,
          mediaUrl: "asset://audio.mp3",
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });

    expect(peakCache.getWaveSurferPeaks).toHaveBeenCalledWith(80);
    expect(load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1, 0, 0.5]], 10);
    expect(appliedZoomPxPerSecRef.current).toBe(80);
  });

  it("calls onZoomApplied after async peaks load completes", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 10);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const onZoomApplied = vi.fn();
    const onZoomAppliedRef = { current: onZoomApplied };
    const peakCache = {
      getWaveSurferPeaks: vi.fn(() => ({
        peaks: [[0, 1]],
        duration: 10,
      })),
    };
    const peakCacheRef = { current: peakCache as never };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          peakCacheRef,
          mediaUrl: "asset://audio.mp3",
          onZoomAppliedRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });
    await Promise.resolve();
    await Promise.resolve();

    expect(zoom).toHaveBeenCalledWith(80);
    expect(onZoomApplied).toHaveBeenCalledWith(80);
  });

  it("restores scroll after peaks load when ws.load resets scroll", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 120);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 120);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 112 };
    const getViewportScrollPxRef = { current: () => 500 };
    const peakCache = {
      getWaveSurferPeaks: vi.fn(() => ({
        peaks: [[0, 1]],
        duration: 120,
      })),
    };
    const peakCacheRef = { current: peakCache as never };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          peakCacheRef,
          mediaUrl: "asset://audio.mp3",
          getViewportScrollPxRef,
        }),
      { initialProps: { minPxPerSec: 112 } },
    );

    rerender({ minPxPerSec: 56 });
    await Promise.resolve();
    await Promise.resolve();

    expect(setScroll).toHaveBeenCalledWith(500);
  });

  it("skips scroll restore when onZoomApplied handles viewport fit", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 500);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 120);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 112 };
    const onZoomAppliedRef = { current: () => true };
    const peakCache = {
      getWaveSurferPeaks: vi.fn(() => ({
        peaks: [[0, 1]],
        duration: 120,
      })),
    };
    const peakCacheRef = { current: peakCache as never };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          peakCacheRef,
          mediaUrl: "asset://audio.mp3",
          onZoomAppliedRef,
        }),
      { initialProps: { minPxPerSec: 112 } },
    );

    rerender({ minPxPerSec: 388 });
    await Promise.resolve();
    await Promise.resolve();

    expect(setScroll).not.toHaveBeenCalled();
  });
});
