import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PeakCache } from "../services/waveform/PeakCache";
import { useWaveformZoomSync } from "./useWaveformZoomSync";

async function flushRaf() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

describe("useWaveformZoomSync", () => {
  it("calls ws.zoom after layout effect when minPxPerSec changes (decode-fallback)", async () => {
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
    expect(zoom).not.toHaveBeenCalled();
    await flushRaf();
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledWith(112);
    expect(appliedZoomPxPerSecRef.current).toBe(112);
    expect(load).not.toHaveBeenCalled();
  });
  it("skips zoom apply while zoomDragging and applies once after commit", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const setOptions = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 10);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, setOptions, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const peakCache = {
      getWaveSurferPeaks: vi.fn(() => ({
        peaks: [[0, 1, 0, 0.5]],
        duration: 10,
      })),
    };
    const peakCacheRef = { current: peakCache as never };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number; zoomDragging: boolean }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          appliedPeaksRef,
          peakCacheRef,
          mediaUrl: "asset://audio.mp3",
          zoomDragging: props.zoomDragging,
        }),
      { initialProps: { minPxPerSec: 56, zoomDragging: true } },
    );

    rerender({ minPxPerSec: 56, zoomDragging: true });
    expect(load).not.toHaveBeenCalled();
    expect(peakCache.getWaveSurferPeaks).not.toHaveBeenCalled();

    rerender({ minPxPerSec: 112, zoomDragging: false });
    expect(peakCache.getWaveSurferPeaks).toHaveBeenCalledWith(112);
    expect(load).not.toHaveBeenCalled();
    await flushRaf();
    expect(appliedZoomPxPerSecRef.current).toBe(112);
    expect(appliedPeaksRef.current).toBe(true);
    expect(setOptions).toHaveBeenCalledWith({ autoScroll: false });
  });

  it("uses canvas peaks path without ws.load when PeakCache is available", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const setOptions = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 10);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, setOptions, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
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
          appliedPeaksRef,
          peakCacheRef,
          mediaUrl: "asset://audio.mp3",
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });

    expect(peakCache.getWaveSurferPeaks).toHaveBeenCalledWith(80);
    expect(load).not.toHaveBeenCalled();
    await flushRaf();
    expect(zoom).not.toHaveBeenCalled();
    expect(setScroll).not.toHaveBeenCalled();
    expect(appliedZoomPxPerSecRef.current).toBe(80);
    expect(appliedPeaksRef.current).toBe(true);
    expect(setOptions).toHaveBeenCalledWith({ autoScroll: false });
  });

  it("calls onZoomApplied after peaks canvas zoom (no async load)", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const setOptions = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 10);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, setOptions, getScroll, getWidth, getDuration };
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
    await flushRaf();

    expect(zoom).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(onZoomApplied).toHaveBeenCalledWith(80);
  });

  it("does not restore ws scroll after peaks canvas zoom", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const setOptions = vi.fn();
    const getScroll = vi.fn(() => 120);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 120);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, setOptions, getScroll, getWidth, getDuration };
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
    await flushRaf();

    expect(setScroll).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it("activates canvas peaks when PeakCache becomes available after ready", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const setOptions = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 120);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration, setOptions };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const appliedPeaksRef = { current: false };
    const peakCache = {
      getWaveSurferPeaks: vi.fn(() => ({
        peaks: [[0, 1]],
        duration: 120,
      })),
    };

    const peakCacheRef = { current: null as PeakCache | null };

    const { rerender } = renderHook(
      (props: { peakCache: typeof peakCache | null }) => {
        peakCacheRef.current = props.peakCache as PeakCache | null;
        return useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: 56,
          appliedZoomPxPerSecRef,
          appliedPeaksRef,
          peakCache: props.peakCache as PeakCache | null,
          peakCacheRef,
          mediaUrl: "asset://audio.mp3",
        });
      },
      { initialProps: { peakCache: null as typeof peakCache | null } },
    );

    expect(load).not.toHaveBeenCalled();

    rerender({ peakCache });

    expect(peakCache.getWaveSurferPeaks).toHaveBeenCalledWith(56);
    expect(load).not.toHaveBeenCalled();
    await flushRaf();
    expect(appliedPeaksRef.current).toBe(true);
    expect(setOptions).toHaveBeenCalledWith({ autoScroll: false });
  });

  it("restores scroll after decode-fallback zoom when onZoomApplied does not handle fit", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 500);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 120);
    const load = vi.fn().mockResolvedValue(undefined);
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 112 };
    const onZoomAppliedRef = { current: () => false };
    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
          mediaUrl: "asset://audio.mp3",
          onZoomAppliedRef,
        }),
      { initialProps: { minPxPerSec: 112 } },
    );
    rerender({ minPxPerSec: 388 });
    await flushRaf();
    expect(setScroll).toHaveBeenCalledWith(500);
    expect(load).not.toHaveBeenCalled();
  });
});
