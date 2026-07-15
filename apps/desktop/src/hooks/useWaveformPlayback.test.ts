// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWaveformPlayback } from "./useWaveformPlayback";

describe("useWaveformPlayback", () => {
  it("begins visual seek before ws.setTime and ends after (Peaks order)", async () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 0,
      isPlaying: () => false,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const layoutDurationSecRef = { current: 60 };
    const layoutTimelineWidthPxRef = { current: 1000 };
    const applyGlobalPlaybackRateRef = { current: vi.fn() };
    const beginVisualSeek = vi.fn();
    const endVisualSeek = vi.fn();
    const snapPlaybackViewportAfterSeek = vi.fn();
    const beginVisualSeekRef = { current: beginVisualSeek };
    const endVisualSeekRef = { current: endVisualSeek };
    const snapPlaybackViewportAfterSeekRef = { current: snapPlaybackViewportAfterSeek };
    const commitSeekUi = vi.fn();
    const order: string[] = [];
    beginVisualSeek.mockImplementation(() => order.push("begin"));
    endVisualSeek.mockImplementation(() => order.push("end"));
    snapPlaybackViewportAfterSeek.mockImplementation(() => order.push("snap"));
    ws.setTime.mockImplementation(() => order.push("media"));
    commitSeekUi.mockImplementation(() => order.push("commit"));

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
        beginVisualSeekRef,
        endVisualSeekRef,
        undefined,
        snapPlaybackViewportAfterSeekRef,
      ),
    );

    act(() => {
      result.current.seek(12.5);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(beginVisualSeek).toHaveBeenCalledWith(12.5, { deferViewportFrame: true });
    expect(snapPlaybackViewportAfterSeek).toHaveBeenCalledWith(12.5);
    expect(endVisualSeek).toHaveBeenCalledWith(12.5);
    expect(ws.setTime).toHaveBeenCalledWith(12.5);
    expect(order).toEqual(["begin", "snap", "media", "end", "commit"]);
    expect(commitSeekUi).toHaveBeenCalledWith(12.5);
  });

  it("seekByDelta uses display playhead as base when ref is wired", async () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 10,
      isPlaying: () => true,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const layoutDurationSecRef = { current: 60 };
    const layoutTimelineWidthPxRef = { current: 1000 };
    const applyGlobalPlaybackRateRef = { current: vi.fn() };
    const beginVisualSeekRef = { current: vi.fn() };
    const endVisualSeekRef = { current: vi.fn() };
    const getDisplayPlayheadTimeSecRef = { current: () => 8 };
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
        beginVisualSeekRef,
        endVisualSeekRef,
        getDisplayPlayheadTimeSecRef,
      ),
    );

    act(() => {
      result.current.seekByDelta(2);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(ws.setTime).toHaveBeenCalledWith(10);
    expect(commitSeekUi).toHaveBeenCalledWith(10);
  });

  it("getPlayheadTime uses ws time when not ready (avoids authority cycle)", () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 3.5,
      isPlaying: () => false,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };

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
        undefined,
        undefined,
      ),
    );

    expect(result.current.getPlayheadTime()).toBe(3.5);
  });

  it("getPlayheadTime uses display time when ref is wired", () => {
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 9.75,
      isPlaying: () => true,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const getDisplayPlayheadTimeSecRef = { current: () => 11.25 };

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
        undefined,
        undefined,
        getDisplayPlayheadTimeSecRef,
      ),
    );

    expect(result.current.getPlayheadTime()).toBe(11.25);
  });

  it("ignores a second togglePlay while media play() is still pending", async () => {
    let resolvePlay!: () => void;
    const play = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePlay = resolve;
        }),
    );
    const pause = vi.fn();
    const ws = {
      setTime: vi.fn(),
      getCurrentTime: () => 0,
      isPlaying: () => false,
      play,
      pause,
    };
    const wsRef = { current: ws as unknown as import("wavesurfer.js").default };
    const applyGlobalPlaybackRateRef = { current: vi.fn() };

    const { result } = renderHook(() =>
      useWaveformPlayback(
        wsRef,
        { current: null },
        true,
        { current: 60 },
        { current: 1000 },
        applyGlobalPlaybackRateRef,
      ),
    );

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.togglePlay();
      second = result.current.togglePlay();
    });

    await act(async () => {
      await second;
    });
    expect(play).toHaveBeenCalledTimes(1);

    resolvePlay();
    await act(async () => {
      await first;
    });
    expect(play).toHaveBeenCalledTimes(1);
    expect(applyGlobalPlaybackRateRef.current).toHaveBeenCalledTimes(1);
  });
});
