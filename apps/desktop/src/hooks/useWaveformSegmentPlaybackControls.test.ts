import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import type WaveSurfer from "wavesurfer.js";

function makeWs(overrides: Partial<{
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  play: (start?: number) => Promise<void>;
  setTime: (t: number) => void;
}> = {}) {
  return {
    getCurrentTime: () => 2,
    isPlaying: () => false,
    pause: vi.fn(),
    setPlaybackRate: vi.fn(),
    setTime: vi.fn(),
    play: vi.fn(async () => {}),
    on: vi.fn(() => () => {}),
    getDuration: () => 100,
    ...overrides,
  } as unknown as WaveSurfer;
}

describe("useWaveformSegmentPlaybackControls", () => {
  const segments = [{ idx: 0, start_sec: 10, end_sec: 20, text: "a" }];

  it("uses authoritative playhead instead of stale ws.getCurrentTime", async () => {
    const ws = makeWs({ getCurrentTime: () => 2 });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 15,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0);
    });

    expect(ws.setTime).toHaveBeenCalledWith(15);
    expect(ws.play).toHaveBeenCalledWith();
  });

  it("syncs imperative playhead before ws.setTime on segment play", async () => {
    const ws = makeWs();
    const wsRef = { current: ws };
    const syncDisplayPlayheadAfterSeek = vi.fn();
    const syncRef = { current: syncDisplayPlayheadAfterSeek };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 2,
        syncDisplayPlayheadAfterSeekRef: syncRef,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 12 });
    });

    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledWith(12);
    expect(ws.setTime).toHaveBeenCalledWith(12);
    expect(syncDisplayPlayheadAfterSeek.mock.invocationCallOrder[0]).toBeLessThan(
      (ws.setTime as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
  });

  it("prefers explicit fromSec over authority", async () => {
    const ws = makeWs();
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 11,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 16.5 });
    });

    expect(ws.setTime).toHaveBeenCalledWith(16.5);
    expect(ws.play).toHaveBeenCalledWith();
  });
});
