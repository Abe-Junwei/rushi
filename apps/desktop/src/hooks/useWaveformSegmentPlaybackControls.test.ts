// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import type WaveSurfer from "wavesurfer.js";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
  schedulePlaybackViewportFrame,
} from "../utils/tierScrollFrameCoordinator";

function makeWs(overrides: Partial<{
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  play: (start?: number) => Promise<void>;
  pause: () => void;
  setTime: (t: number) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => () => void;
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

/** Multi-listener ws.on mock (WaveSurfer allows many; Map-per-event drops earlier subs). */
function makeWsEventBag() {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    const list = handlers.get(event) ?? [];
    list.push(cb);
    handlers.set(event, list);
    return () => {
      const next = (handlers.get(event) ?? []).filter((fn) => fn !== cb);
      if (next.length === 0) handlers.delete(event);
      else handlers.set(event, next);
    };
  });
  const emit = (event: string, ...args: unknown[]) => {
    for (const cb of handlers.get(event) ?? []) cb(...args);
  };
  return { on, emit };
}

/** Bound-sync stop awaits host.pause(); flush microtasks for finally handlers. */
async function flushDeferredSegmentStop() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useWaveformSegmentPlaybackControls", () => {
  const segments = [{ idx: 0, start_sec: 10, end_sec: 20, text: "a" }];

  beforeEach(() => {
    resetTierScrollFrameCoordinatorForTests();
  });

  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
  });

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

  it("resumes without seeking when display lags raw beyond epsilon but within lag cap", async () => {
    const ws = makeWs({ getCurrentTime: () => 15.0 });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 14.7,
        getRawMediaPlayheadTimeSec: () => 15.0,
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

  it("seeks to segment start when playhead is before the segment", async () => {
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
    expect(ws.play).toHaveBeenCalledWith();
  });

  it("plays from playhead past segment end without snapping to start", async () => {
    const ws = makeWs({ getCurrentTime: () => 25 });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 25,
        getRawMediaPlayheadTimeSec: () => 2,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0);
    });

    expect(ws.setTime).toHaveBeenCalledWith(25);
    expect(ws.play).toHaveBeenCalledWith();
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

  it("H3: Space plays CM6 projection segment when React SC1 still lags on previous", async () => {
    const {
      resetTranscriptProjectionForTests,
      seedTranscriptProjectionForTests,
    } = await import("../components/editor/core/transcriptProjection");
    resetTranscriptProjectionForTests();
    seedTranscriptProjectionForTests({
      primaryIdx: 1,
      selectedSet: new Set([1]),
      rangeAnchor: 1,
      lineCount: 2,
    });

    const segs = [
      { idx: 0, start_sec: 10, end_sec: 20, text: "a" },
      { idx: 1, start_sec: 30, end_sec: 40, text: "b" },
    ];
    // Paused mid-A: display/raw still in A; SC1 still 0; CM6 projection already B.
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
    resetTranscriptProjectionForTests();
  });

  it("Space starts playback when media is paused even if segment-playing UI flag is stale true", async () => {
    const {
      resetTranscriptProjectionForTests,
      seedTranscriptProjectionForTests,
    } = await import("../components/editor/core/transcriptProjection");
    resetTranscriptProjectionForTests();
    seedTranscriptProjectionForTests({
      primaryIdx: 0,
      selectedSet: new Set([0]),
      rangeAnchor: 0,
      lineCount: 1,
    });

    let playing = false;
    const ws = makeWs({
      getCurrentTime: () => 15,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
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
    act(() => {
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
    resetTranscriptProjectionForTests();
  });

  it("does not abort playback when WaveSurfer emits play before play() resolves", async () => {
    const {
      resetTranscriptProjectionForTests,
      seedTranscriptProjectionForTests,
    } = await import("../components/editor/core/transcriptProjection");
    resetTranscriptProjectionForTests();
    seedTranscriptProjectionForTests({
      primaryIdx: 0,
      selectedSet: new Set([0]),
      rangeAnchor: 0,
      lineCount: 1,
    });

    let playing = false;
    const handlers = new Map<string, () => void>();
    const ws = makeWs({
      getCurrentTime: () => 10,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        handlers.get("play")?.();
        return Promise.resolve();
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
    resetTranscriptProjectionForTests();
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

  it("segment play button cuts from global playback into scoped segment play", async () => {
    let playing = true;
    let playhead = 5;
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      pause: vi.fn(() => {
        playing = false;
      }),
      setTime: vi.fn((t: number) => {
        playhead = t;
      }),
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
      }),
    );

    act(() => {
      result.current.beginGlobalPlayback();
    });

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.pause).not.toHaveBeenCalled();
    expect(ws.setTime).toHaveBeenCalledWith(10);
    // Already playing globally: seek only — do not pause+play (WebKit AudioSession).
    expect(ws.play).not.toHaveBeenCalled();
    expect(playing).toBe(true);
    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
  });

  it("blank global Space arm survives beginGlobalPlayback until explicitly cleared", () => {
    const ws = makeWs();
    const wsRef = { current: ws };
    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => 0,
      }),
    );

    act(() => {
      result.current.beginGlobalPlayback();
      result.current.armBlankGlobalSpace();
    });
    expect(result.current.isBlankGlobalSpaceArmed()).toBe(true);

    act(() => {
      result.current.beginGlobalPlayback();
    });
    expect(result.current.isBlankGlobalSpaceArmed()).toBe(true);

    act(() => {
      result.current.clearBlankGlobalSpaceArm();
    });
    expect(result.current.isBlankGlobalSpaceArmed()).toBe(false);

    // Idempotent clear/arm must not throw or flip unexpectedly.
    act(() => {
      result.current.clearBlankGlobalSpaceArm();
      result.current.armBlankGlobalSpace();
      result.current.armBlankGlobalSpace();
    });
    expect(result.current.isBlankGlobalSpaceArmed()).toBe(true);
  });

  it("segment play button cuts from global playback at/past segment end back to segment start", async () => {
    let playing = true;
    let playhead = 25;
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      pause: vi.fn(() => {
        playing = false;
      }),
      setTime: vi.fn((t: number) => {
        playhead = t;
      }),
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
      }),
    );

    act(() => {
      result.current.beginGlobalPlayback();
    });

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).toHaveBeenCalledWith(10);
    expect(ws.setTime).not.toHaveBeenCalledWith(25);
    // Already playing: seek-only cut into segment — no nested pause+play.
    expect(ws.pause).not.toHaveBeenCalled();
    expect(ws.play).not.toHaveBeenCalled();
    expect(playing).toBe(true);
    expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
  });

  it("does not store a pause anchor when freeze time is outside the selected segment", async () => {
    let playing = false;
    let playhead = 30;
    const segs = [
      { idx: 0, start_sec: 10, end_sec: 20, text: "a" },
      { idx: 1, start_sec: 30, end_sec: 40, text: "b" },
    ];
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      pause: vi.fn(() => {
        playing = false;
      }),
      setTime: vi.fn((t: number) => {
        playhead = t;
      }),
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segs],
        selectedIdx: 1,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
      }),
    );

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });
    expect(playing).toBe(true);

    playhead = 19.5;
    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });
    expect(playing).toBe(false);

    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).toHaveBeenCalledWith(30);
    expect(ws.setTime).not.toHaveBeenCalledWith(19.5);
    expect(playing).toBe(true);
  });

  it("resumes from the captured pause anchor when raw and display clocks fall backward", async () => {
    let playing = true;
    let rawMediaSec = 15.8;
    let displaySec = 15.6;
    const ws = makeWs({
      getCurrentTime: () => rawMediaSec,
      isPlaying: () => playing,
      pause: vi.fn(() => {
        playing = false;
      }),
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => displaySec,
        getRawMediaPlayheadTimeSec: () => rawMediaSec,
      }),
    );

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });
    expect(ws.pause).toHaveBeenCalled();

    // Both observable clocks can lag after pause; the explicit pause anchor must win.
    rawMediaSec = 15.1;
    displaySec = 14.9;
    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).toHaveBeenCalledWith(15.8);
    expect(ws.setTime).not.toHaveBeenCalledWith(14.9);
    expect(ws.play).toHaveBeenCalled();
  });

  it("does not override an explicit seek made after pause", async () => {
    let playing = true;
    let playheadSec = 15.8;
    const ws = makeWs({
      getCurrentTime: () => playheadSec,
      isPlaying: () => playing,
      pause: vi.fn(() => {
        playing = false;
      }),
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
    });
    const wsRef = { current: ws };
    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playheadSec,
        getRawMediaPlayheadTimeSec: () => playheadSec,
      }),
    );

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    playheadSec = 12;
    act(() => {
      result.current.clearPausedResumeAnchor();
    });
    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).not.toHaveBeenCalledWith(15.8);
    expect(ws.play).toHaveBeenCalled();
  });

  it("keeps Stop icon when selecting another segment while media is already inside it", async () => {
    const {
      resetTranscriptProjectionForTests,
      seedTranscriptProjectionForTests,
    } = await import("../components/editor/core/transcriptProjection");
    resetTranscriptProjectionForTests();

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

    act(() => {
      // Simulate already-playing segment A (bound armed via select sync path).
      playing = true;
      playhead = 15;
      rerender({ selectedIdx: 0 });
    });
    expect(result.current.isSelectedSegmentPlaying).toBe(true);

    playhead = 30;
    seedTranscriptProjectionForTests({
      primaryIdx: 1,
      selectedSet: new Set([1]),
      rangeAnchor: 1,
      lineCount: 2,
    });
    act(() => {
      rerender({ selectedIdx: 1 });
    });

    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    resetTranscriptProjectionForTests();
  });

  it("updates Stop icon from CM6 projection before React selectedIdx catches up", async () => {
    const {
      resetTranscriptProjectionForTests,
      seedTranscriptProjectionForTests,
    } = await import("../components/editor/core/transcriptProjection");
    resetTranscriptProjectionForTests();
    seedTranscriptProjectionForTests({
      primaryIdx: 0,
      selectedSet: new Set([0]),
      rangeAnchor: 0,
      lineCount: 2,
    });

    const playhead = 30;
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
      seedTranscriptProjectionForTests({
        primaryIdx: 1,
        selectedSet: new Set([1]),
        rangeAnchor: 1,
        lineCount: 2,
      });
      await Promise.resolve();
    });

    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    resetTranscriptProjectionForTests();
  });

  it("auto-stops at segment end with pause only (no seek, no visual rewind)", async () => {
    let playhead = 10;
    let playing = false;
    const { on, emit } = makeWsEventBag();
    const commitSeekUi = vi.fn((t: number) => {
      playhead = t;
    });
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
      on,
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
        commitSeekUi,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 10 });
    });
    expect(playing).toBe(true);
    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();
    commitSeekUi.mockClear();

    // Arm the bound while still inside the segment, then cross the end.
    playhead = 15;
    act(() => {
      emit("audioprocess");
    });
    playhead = 19.99;
    await act(async () => {
      emit("audioprocess");
      await flushDeferredSegmentStop();
    });

    expect(ws.pause).toHaveBeenCalled();
    // Pause only — no media setTime and no visual rewind (WebKit AudioSession safe).
    expect(ws.setTime).not.toHaveBeenCalled();
    expect(commitSeekUi).not.toHaveBeenCalled();
    expect(playhead).toBe(19.99);
  });

  it("global play does not auto-scope-stop at selected segment end", async () => {
    let playhead = 15;
    let playing = false;
    const { on, emit } = makeWsEventBag();
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        queueMicrotask(() => emit("play"));
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
      on,
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
      }),
    );

    act(() => {
      result.current.beginGlobalPlayback();
    });
    playing = true;
    await act(async () => {
      emit("play");
      emit("audioprocess");
      await Promise.resolve();
    });
    expect(result.current.isSelectedSegmentPlaying).toBe(false);

    playhead = 19.99;
    await act(async () => {
      emit("audioprocess");
      schedulePlaybackViewportFrame(playhead);
      flushTierScrollFrameForTests();
      await Promise.resolve();
    });

    expect(ws.pause).not.toHaveBeenCalled();
    expect(playing).toBe(true);
    expect(result.current.isSelectedSegmentPlaying).toBe(false);
  });

  it("auto-stops on Rushi playback frame when past end without audioprocess", async () => {
    // WS-2b: audioprocess is sparse; visual clock drives playback frames. Sync must
    // not clear the bound before enforce can pause (overshoot past endSec).
    let playhead = 10;
    let playing = false;
    const commitSeekUi = vi.fn((t: number) => {
      playhead = t;
    });
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
        commitSeekUi,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 10 });
    });
    expect(playing).toBe(true);
    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();
    commitSeekUi.mockClear();

    playhead = 15;
    act(() => {
      schedulePlaybackViewportFrame(15);
      flushTierScrollFrameForTests();
    });

    playhead = 22;
    await act(async () => {
      schedulePlaybackViewportFrame(22);
      flushTierScrollFrameForTests();
      await flushDeferredSegmentStop();
    });

    expect(ws.pause).toHaveBeenCalled();
    expect(playing).toBe(false);
    expect(ws.setTime).not.toHaveBeenCalled();
    expect(commitSeekUi).not.toHaveBeenCalled();
    expect(playhead).toBe(22);
  });

  it("replays from segment start after auto-stopping at segment end", async () => {
    let playhead = 10;
    let playing = false;
    const commitSeekUi = vi.fn((t: number) => {
      playhead = t;
    });
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
        commitSeekUi,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 10 });
    });
    commitSeekUi.mockClear();

    playhead = 15;
    act(() => {
      schedulePlaybackViewportFrame(15);
      flushTierScrollFrameForTests();
    });

    playhead = 20;
    await act(async () => {
      schedulePlaybackViewportFrame(20);
      flushTierScrollFrameForTests();
      await flushDeferredSegmentStop();
    });

    expect(playing).toBe(false);
    // Pause only at end — no visual rewind; playhead stays at the segment end.
    expect(commitSeekUi).not.toHaveBeenCalled();
    expect(playhead).toBe(20);

    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).toHaveBeenCalledWith(10);
    expect(ws.setTime).not.toHaveBeenCalledWith(20);
    expect(playing).toBe(true);
  });

  it("one press replays when playhead is left at the segment end (media at end)", async () => {
    // Pause-only natural end: display and media both stay at end. A single play
    // click must seek to segment start and play, not resume from the tail.
    let playhead = 10;
    let playing = false;
    const commitSeekUi = vi.fn((t: number) => {
      playhead = t;
    });
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      setTime: vi.fn((t: number) => {
        playhead = t;
      }),
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
        commitSeekUi,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 10 });
    });
    commitSeekUi.mockClear();

    playhead = 15;
    act(() => {
      schedulePlaybackViewportFrame(15);
      flushTierScrollFrameForTests();
    });

    playhead = 20;
    await act(async () => {
      schedulePlaybackViewportFrame(20);
      flushTierScrollFrameForTests();
      await flushDeferredSegmentStop();
    });

    expect(playing).toBe(false);
    expect(commitSeekUi).not.toHaveBeenCalled();
    expect(playhead).toBe(20);

    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();
    (ws.play as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).toHaveBeenCalledWith(10);
    expect(ws.play).toHaveBeenCalled();
    expect(playing).toBe(true);
    expect(playhead).toBe(10);

    // Stale end-time frame (pre-seek clock) must not immediately re-stop.
    playhead = 20;
    await act(async () => {
      schedulePlaybackViewportFrame(20);
      flushTierScrollFrameForTests();
      await Promise.resolve();
    });
    expect(playing).toBe(true);

    playhead = 10.2;
    await act(async () => {
      schedulePlaybackViewportFrame(10.2);
      flushTierScrollFrameForTests();
      await Promise.resolve();
    });
    expect(playing).toBe(true);
  });

  it("Space sticky path after natural end: session kept and playSegmentAtIndex seeks to start", async () => {
    const { resolveSessionTogglePlay } = await import("../utils/playbackSessionToggle");
    let playhead = 10;
    let playing = false;
    const commitSeekUi = vi.fn((t: number) => {
      playhead = t;
    });
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
        commitSeekUi,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 10 });
    });
    expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
    commitSeekUi.mockClear();

    playhead = 15;
    act(() => {
      schedulePlaybackViewportFrame(15);
      flushTierScrollFrameForTests();
    });
    playhead = 20;
    await act(async () => {
      schedulePlaybackViewportFrame(20);
      flushTierScrollFrameForTests();
      await flushDeferredSegmentStop();
    });

    expect(playing).toBe(false);
    expect(result.current.isSelectedSegmentPlaying).toBe(false);
    expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
    // Pause only — playhead stays at end; replay-from-start resolved on next play.
    expect(commitSeekUi).not.toHaveBeenCalled();
    expect(playhead).toBe(20);

    const decision = resolveSessionTogglePlay({
      isPlaying: false,
      session: result.current.getPlaybackSession(),
      segmentStillExists: true,
    });
    expect(decision).toEqual({ action: "resumeSegment", idx: 0 });

    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => {
      if (decision.action === "resumeSegment") {
        await result.current.playSegmentAtIndex(decision.idx);
      }
    });

    expect(ws.setTime).toHaveBeenCalledWith(10);
    expect(ws.setTime).not.toHaveBeenCalledWith(20);
    expect(playing).toBe(true);
    expect(result.current.isSelectedSegmentPlaying).toBe(true);
    expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
  });

  it("mid-segment sticky pause/resume (Shift+Space path) still auto-stops at end", async () => {
    const { resolveSessionTogglePlay } = await import("../utils/playbackSessionToggle");
    const { resolveStickySegmentSpaceFromSec } = await import("../utils/segmentResumeFromSec");
    let playhead = 12;
    let playing = false;
    const commitSeekUi = vi.fn((t: number) => {
      playhead = t;
    });
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
      setTime: vi.fn((t: number) => {
        playhead = t;
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
        commitSeekUi,
      }),
    );

    const stickyToggle = async () => {
      const decision = resolveSessionTogglePlay({
        isPlaying: playing,
        session: result.current.getPlaybackSession(),
        segmentStillExists: true,
        selectedSegmentIdx: 0,
      });
      if (decision.action === "pauseKeepingSession") {
        result.current.pauseMediaKeepingSession();
        return;
      }
      if (decision.action === "resumeSegment") {
        const seg = segments[decision.idx]!;
        const stickyFromSec = resolveStickySegmentSpaceFromSec({
          segment: seg,
          displaySec: playhead,
        });
        await result.current.playSegmentAtIndex(
          decision.idx,
          stickyFromSec != null ? { fromSec: stickyFromSec } : undefined,
        );
      }
    };

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 12 });
    });
    expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
    expect(result.current.isSelectedSegmentPlaying).toBe(true);

    // Repeated mid-segment Shift+Space pause ↔ resume.
    for (const freezeAt of [13, 14, 16, 17]) {
      playhead = freezeAt;
      await act(async () => {
        await stickyToggle();
      });
      expect(playing).toBe(false);
      expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });

      await act(async () => {
        await stickyToggle();
      });
      expect(playing).toBe(true);
      expect(result.current.isSelectedSegmentPlaying).toBe(true);
      expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
    }

    playhead = 20;
    await act(async () => {
      schedulePlaybackViewportFrame(20);
      flushTierScrollFrameForTests();
      await flushDeferredSegmentStop();
    });

    expect(playing).toBe(false);
    expect(result.current.isSelectedSegmentPlaying).toBe(false);
    expect(result.current.getPlaybackSession()).toEqual({ kind: "segment", idx: 0 });
    // Pause only at end — no rewind to segment start; playhead stays at end.
    expect(commitSeekUi).not.toHaveBeenCalledWith(10);
    expect(playhead).toBe(20);
  });

  it("does not replay from segment start after seek clears auto-stop replay intent", async () => {
    let playhead = 10;
    let playing = false;
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
    });
    const wsRef = { current: ws };

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 10 });
    });

    playhead = 15;
    act(() => {
      schedulePlaybackViewportFrame(15);
      flushTierScrollFrameForTests();
    });

    playhead = 20;
    await act(async () => {
      schedulePlaybackViewportFrame(20);
      flushTierScrollFrameForTests();
      await flushDeferredSegmentStop();
    });
    expect(playing).toBe(false);

    act(() => {
      result.current.clearPausedResumeAnchor();
    });
    playhead = 25;
    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();

    await act(async () => {
      await result.current.handleToggleSelectedWaveformPlay();
    });

    expect(ws.setTime).not.toHaveBeenCalledWith(10);
    expect(ws.play).toHaveBeenCalled();
    expect(playing).toBe(true);
  });

  it("segment-end bound pause does not seek playhead", async () => {
    let playhead = 10;
    let playing = false;
    const { on, emit } = makeWsEventBag();
    const ws = makeWs({
      getCurrentTime: () => playhead,
      isPlaying: () => playing,
      play: vi.fn(() => {
        playing = true;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        playing = false;
      }),
      on,
    });
    const wsRef = { current: ws };
    const syncDisplay = vi.fn();

    const { result } = renderHook(() =>
      useWaveformSegmentPlaybackControls({
        wsRef,
        isReady: true,
        segments: [...segments],
        selectedIdx: 0,
        getGlobalPlaybackRate: () => 1,
        getPlayheadTime: () => playhead,
        getRawMediaPlayheadTimeSec: () => playhead,
        syncDisplayPlayheadAfterSeekRef: { current: syncDisplay },
      }),
    );

    await act(async () => {
      await result.current.playSegmentAtIndex(0, { fromSec: 10 });
    });
    playhead = 15;
    act(() => {
      emit("audioprocess");
    });
    (ws.setTime as ReturnType<typeof vi.fn>).mockClear();

    playhead = 19.99;
    await act(async () => {
      emit("audioprocess");
      await flushDeferredSegmentStop();
    });

    expect(playing).toBe(false);
    expect(ws.setTime).not.toHaveBeenCalled();
    expect(ws.pause).toHaveBeenCalled();
  });
});
