import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PeakCache } from "../services/waveform/PeakCache";
import { useWaveformZoomSync } from "./useWaveformZoomSync";

async function flushZoomFrames() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
  await Promise.resolve();
}

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

  it("uses peaks resample + ws.load instead of ws.zoom when PeakCache is available", async () => {
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
    await flushZoomFrames();
    expect(load).toHaveBeenCalledWith("asset://audio.mp3", [[0, 1, 0, 0.5]], 10);
    await flushZoomFrames();
    expect(zoom).not.toHaveBeenCalled();
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
    await flushZoomFrames();
    await flushZoomFrames();

    expect(zoom).not.toHaveBeenCalled();
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
    await flushZoomFrames();
    await flushZoomFrames();

    expect(setScroll).toHaveBeenCalledWith(500);
  });

  it("restores preserved scroll when onZoomApplied does not handle viewport fit", async () => {
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
    await flushZoomFrames();
    await flushZoomFrames();

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

  it("loads peaks when PeakCache becomes available after ready", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 0);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 120);
    const load = vi.fn().mockResolvedValue(undefined);
    const setOptions = vi.fn();
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
    await flushZoomFrames();
    expect(load).toHaveBeenCalled();
    await flushZoomFrames();
    expect(appliedPeaksRef.current).toBe(true);
  });

  it("ignores stale peaks load completion when a newer zoom request started", async () => {
    const zoom = vi.fn();
    const setScroll = vi.fn();
    const getScroll = vi.fn(() => 100);
    const getWidth = vi.fn(() => 800);
    const getDuration = vi.fn(() => 120);
    let resolveFirst: (() => void) | undefined;
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const setOptions = vi.fn();
    const ws = { zoom, load, setScroll, getScroll, getWidth, getDuration, setOptions };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };
    const peakCache = {
      getWaveSurferPeaks: vi.fn((px: number) => ({
        peaks: [[0, px]],
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
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });
    await flushZoomFrames();
    rerender({ minPxPerSec: 120 });
    await flushZoomFrames();
    await flushZoomFrames();

    expect(appliedZoomPxPerSecRef.current).toBe(120);
    const scrollCallsBeforeStale = setScroll.mock.calls.length;

    resolveFirst?.();
    await flushZoomFrames();
    await flushZoomFrames();

    expect(appliedZoomPxPerSecRef.current).toBe(120);
    expect(setScroll.mock.calls.length).toBe(scrollCallsBeforeStale);
  });
});
