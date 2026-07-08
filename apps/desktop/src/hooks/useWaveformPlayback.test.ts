// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWaveformPlayback } from "./useWaveformPlayback";

describe("useWaveformPlayback", () => {
  it("syncs imperative playhead before ws.setTime (Peaks order)", () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 0,
      isPlaying: () => false,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const layoutDurationSecRef = { current: 60 };
    const layoutTimelineWidthPxRef = { current: 1000 };
    const applyGlobalPlaybackRateRef = { current: vi.fn() };
    const syncDisplayPlayheadAfterSeek = vi.fn();
    const syncDisplayPlayheadAfterSeekRef = {
      current: syncDisplayPlayheadAfterSeek,
    };
    const commitSeekUi = vi.fn();
    const order: string[] = [];
    syncDisplayPlayheadAfterSeek.mockImplementation(() => order.push("playhead"));
    ws.setTime.mockImplementation(() => order.push("media"));

    const { result } = renderHook(() =>
      useWaveformPlayback(
        wsRef,
        { current: null },
        true,
        layoutDurationSecRef,
        layoutTimelineWidthPxRef,
        applyGlobalPlaybackRateRef,
        undefined,
        undefined,
        commitSeekUi,
        syncDisplayPlayheadAfterSeekRef,
      ),
    );

    act(() => {
      result.current.seek(12.5);
    });

    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledWith(12.5);
    expect(ws.setTime).toHaveBeenCalledWith(12.5);
    expect(order).toEqual(["playhead", "media"]);
    expect(commitSeekUi).toHaveBeenCalledWith(12.5);
  });

  it("seekByDelta uses authoritative playhead as base", () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 1,
      isPlaying: () => true,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const layoutDurationSecRef = { current: 60 };
    const layoutTimelineWidthPxRef = { current: 1000 };
    const applyGlobalPlaybackRateRef = { current: vi.fn() };
    const authorityRef = { current: () => 10 };
    const syncDisplayPlayheadAfterSeekRef = { current: vi.fn() };
    const commitSeekUi = vi.fn();

    const { result } = renderHook(() =>
      useWaveformPlayback(
        wsRef,
        { current: null },
        true,
        layoutDurationSecRef,
        layoutTimelineWidthPxRef,
        applyGlobalPlaybackRateRef,
        undefined,
        undefined,
        commitSeekUi,
        syncDisplayPlayheadAfterSeekRef,
        authorityRef,
      ),
    );

    act(() => {
      result.current.seekByDelta(2);
    });

    expect(ws.setTime).toHaveBeenCalledWith(12);
    expect(commitSeekUi).toHaveBeenCalledWith(12);
  });

  it("getPlayheadTime uses ws time when not ready (avoids authority cycle)", () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 3.5,
      isPlaying: () => false,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const authorityRef = {
      current: vi.fn(() => {
        throw new Error("authority must not run before waveform is ready");
      }),
    };

    const { result } = renderHook(() =>
      useWaveformPlayback(
        wsRef,
        { current: null },
        false,
        { current: 60 },
        { current: 1000 },
        { current: vi.fn() },
        undefined,
        undefined,
        vi.fn(),
        { current: vi.fn() },
        authorityRef,
      ),
    );

    expect(result.current.getPlayheadTime()).toBe(3.5);
    expect(authorityRef.current).not.toHaveBeenCalled();
  });

  it("getPlayheadTime returns authoritative time when wired", () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 1,
      isPlaying: () => true,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const authorityRef = { current: () => 9.75 };

    const { result } = renderHook(() =>
      useWaveformPlayback(
        wsRef,
        { current: null },
        true,
        { current: 60 },
        { current: 1000 },
        { current: vi.fn() },
        undefined,
        undefined,
        vi.fn(),
        { current: vi.fn() },
        authorityRef,
      ),
    );

    expect(result.current.getPlayheadTime()).toBe(9.75);
  });

  it("marks imperative playhead sync suppress window before setTime", () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 0,
      isPlaying: () => false,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const suppressUntilRef = { current: 0 };
    const before = performance.now();

    const { result } = renderHook(() =>
      useWaveformPlayback(
        wsRef,
        { current: null },
        true,
        { current: 60 },
        { current: 1000 },
        { current: vi.fn() },
        undefined,
        undefined,
        vi.fn(),
        { current: vi.fn() },
        undefined,
        suppressUntilRef,
      ),
    );

    act(() => {
      result.current.seek(7);
    });

    expect(ws.setTime).toHaveBeenCalledWith(7);
    expect(suppressUntilRef.current).toBeGreaterThan(before);
    expect(suppressUntilRef.current).toBeLessThanOrEqual(performance.now() + 50);
  });
});
