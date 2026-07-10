// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import type WaveSurfer from "wavesurfer.js";

function makeWs(overrides: Partial<{
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  play: (start?: number) => Promise<void>;
  setTime: (t: number) => void;
  on: (event: string, cb: () => void) => () => void;
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

  it("resumes without seeking when raw media is already inside the segment", async () => {
    // Raw media at 14.5 (inside [10,20)); display lags at 14.48. Resuming must NOT seek
    // back to the lagging display time — no setTime, just play from current position.
    const ws = makeWs({ getCurrentTime: () => 14.5 });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 14.48,
        getRawMediaPlayheadTimeSec: () => 14.5,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0);
    });

    expect(ws.setTime).not.toHaveBeenCalled();
    expect(ws.play).toHaveBeenCalledWith();
  });

  it("seeks to display playhead when raw media is stale inside the selected segment", async () => {
    // Segment selection seek has moved display to the segment start, but the media
    // element can still report an older paused in-segment position for a short window.
    // Starting segment playback must honor the visible playhead, not stale raw media.
    const ws = makeWs({ getCurrentTime: () => 14.5 });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 10,
        getRawMediaPlayheadTimeSec: () => 14.5,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0);
    });

    expect(ws.setTime).toHaveBeenCalledWith(10);
    expect(ws.play).toHaveBeenCalledWith();
  });

  it("seeks to segment start when raw media is outside the segment", async () => {
    const ws = makeWs({ getCurrentTime: () => 2 });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 2,
        getRawMediaPlayheadTimeSec: () => 2,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0);
    });

    expect(ws.setTime).toHaveBeenCalledWith(10);
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

  it("H3: Space plays SC2 chrome segment when React SC1 still lags on previous", async () => {
    const {
      commitSelectionChrome,
      resetSelectionChromeStoreForTests,
    } = await import("../services/selection/selectionChromeStore");
    resetSelectionChromeStoreForTests();
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 1,
      selectedSet: new Set([1]),
    });

    const segs = [
      { idx: 0, start_sec: 10, end_sec: 20, text: "a" },
      { idx: 1, start_sec: 30, end_sec: 40, text: "b" },
    ];
    // Paused mid-A: display/raw still in A; SC1 still 0; SC2 already B.
    const ws = makeWs({ getCurrentTime: () => 15 });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segs],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 15,
        getRawMediaPlayheadTimeSec: () => 15,
      }),
    );

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).toHaveBeenCalledWith(30);
    expect(ws.play).toHaveBeenCalled();
    resetSelectionChromeStoreForTests();
  });

  it("Space starts playback when media is paused even if segment-playing UI flag is stale true", async () => {
    const {
      commitSelectionChrome,
      resetSelectionChromeStoreForTests,
    } = await import("../services/selection/selectionChromeStore");
    resetSelectionChromeStoreForTests();
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 0,
      selectedSet: new Set([0]),
    });

    let playing = false;
    const ws = makeWs({
      getCurrentTime: () => 15,
      isPlaying: () => playing,
      play: vi.fn(async () => {
        playing = true;
      }),
    });
    const wsRef = { current: ws };

    const { result, rerender } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [{ idx: 0, start_sec: 10, end_sec: 20, text: "a" }],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 15,
        getRawMediaPlayheadTimeSec: () => 15,
      }),
    );

    // Force UI flag true while media is paused (the regression that blocked Space).
    playing = true;
    await act(async () => {
      rerender();
    });
    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    playing = false;
    // Do not wait for sync effect — toggle must still start play from live media.
    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.play).toHaveBeenCalled();
    expect(ws.pause).not.toHaveBeenCalled();
    resetSelectionChromeStoreForTests();
  });

  it("does not abort playback when WaveSurfer emits play before play() resolves", async () => {
    const {
      commitSelectionChrome,
      resetSelectionChromeStoreForTests,
    } = await import("../services/selection/selectionChromeStore");
    resetSelectionChromeStoreForTests();
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 0,
      selectedSet: new Set([0]),
    });

    let playing = false;
    const handlers = new Map<string, () => void>();
    const ws = makeWs({
      getCurrentTime: () => 10,
      isPlaying: () => playing,
      play: vi.fn(async () => {
        playing = true;
        handlers.get("play")?.();
      }),
      on: vi.fn((event: string, cb: () => void) => {
        handlers.set(event, cb);
        return () => handlers.delete(event);
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [{ idx: 0, start_sec: 10, end_sec: 20, text: "a" }],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 10,
        getRawMediaPlayheadTimeSec: () => 10,
      }),
    );

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.play).toHaveBeenCalled();
    expect(ws.pause).not.toHaveBeenCalled();
    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    resetSelectionChromeStoreForTests();
  });

  it("Space pauses when media is playing even if segment-playing flag was cleared by select", async () => {
    const sync = vi.fn();
    const syncRef = { current: sync };
    // Playing in new segment after select cleared isSelectedSegmentPlaying.
    const ws = makeWs({
      getCurrentTime: () => 31,
      isPlaying: () => true,
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [
          { idx: 0, start_sec: 10, end_sec: 20, text: "a" },
          { idx: 1, start_sec: 30, end_sec: 40, text: "b" },
        ],
        selectedIdx: 1,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 31,
        getRawMediaPlayheadTimeSec: () => 31,
        syncDisplayPlayheadAfterSeekRef: syncRef,
      }),
    );

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.pause).toHaveBeenCalled();
    expect(ws.play).not.toHaveBeenCalled();
    expect(sync).toHaveBeenCalledWith(31);
  });

  it("keeps Stop icon when selecting another segment while media is already inside it", async () => {
    const {
      commitSelectionChrome,
      resetSelectionChromeStoreForTests,
    } = await import("../services/selection/selectionChromeStore");
    resetSelectionChromeStoreForTests();

    let playhead = 15;
    let playing = true;
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
    });
    const wsRef = { current: ws };
    const segs = [
      { idx: 0, start_sec: 10, end_sec: 20, text: "a" },
      { idx: 1, start_sec: 30, end_sec: 40, text: "b" },
    ];

    const { result, rerender } = renderHook(
      ({ selectedIdx }) =>
        useWaveformSegmentPlaybackControls({
          wsRef,
          isReady: true,
          segments: [...segs],
          selectedIdx,
          getGlobalPlaybackRate: () => 1,
          getPlayheadTime: () => playhead,
          getRawMediaPlayheadTimeSec: () => playhead,
        }),
      { initialProps: { selectedIdx: 0 } },
    );

    await act(async () => {
      // Simulate already-playing segment A (bound armed via select sync path).
      playing = true;
      playhead = 15;
      rerender({ selectedIdx: 0 });
    });
    expect(result.current.isSelectedSegmentPlaying).toBe(true);

    playhead = 30;
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 1,
      selectedSet: new Set([1]),
    });
    await act(async () => {
      rerender({ selectedIdx: 1 });
    });

    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    resetSelectionChromeStoreForTests();
  });

  it("updates Stop icon from SC2 chrome before React selectedIdx catches up", async () => {
    const {
      commitSelectionChrome,
      resetSelectionChromeStoreForTests,
    } = await import("../services/selection/selectionChromeStore");
    resetSelectionChromeStoreForTests();
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 0,
      selectedSet: new Set([0]),
    });

    let playhead = 30;
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => true,
    });
    const wsRef = { current: ws };
    const segs = [
      { idx: 0, start_sec: 10, end_sec: 20, text: "a" },
      { idx: 1, start_sec: 30, end_sec: 40, text: "b" },
    ];

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segs],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
      }),
    );

    expect(result.current.isSelectedSegmentPlaying).toBe(false);

    await act(async () => {
      commitSelectionChrome({
        fileId: "f1",
        primaryIdx: 1,
        selectedSet: new Set([1]),
      });
      await Promise.resolve();
    });

    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    resetSelectionChromeStoreForTests();
  });
});
