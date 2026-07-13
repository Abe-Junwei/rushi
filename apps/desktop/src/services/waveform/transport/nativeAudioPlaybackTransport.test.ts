import { describe, expect, it, vi, beforeEach } from "vitest";
import { createNativeAudioPlaybackTransport } from "./nativeAudioPlaybackTransport";
import { resolveMediaPlaybackHost } from "./resolveMediaPlaybackHost";
import { transportAsMediaSink } from "./playbackTransport";
import type { NativeAudioEvent } from "../../../tauri/nativeAudioApi";

type FakeChannel = {
  onmessage: ((ev: NativeAudioEvent) => void) | null;
};

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage: ((ev: NativeAudioEvent) => void) | null = null;
  },
  invoke: vi.fn(),
}));

let lastChannel: FakeChannel | null = null;

function emitEngine(ev: NativeAudioEvent) {
  lastChannel?.onmessage?.(ev);
}

vi.mock("../../../tauri/nativeAudioApi", () => ({
  nativeAudioLoad: vi.fn(
    (path: string, durationSec: number, onEvent: FakeChannel) => {
      lastChannel = onEvent;
      queueMicrotask(() => {
        onEvent.onmessage?.({
          event: "ready",
          data: { durationSec },
        });
      });
      return Promise.resolve({
        playing: false,
        currentTimeSec: 0,
        durationSec,
        rate: 1,
        path,
      });
    },
  ),
  nativeAudioPlay: vi.fn(() => {
    emitEngine({ event: "playing" });
    return Promise.resolve();
  }),
  nativeAudioPause: vi.fn(() => {
    emitEngine({ event: "paused" });
    return Promise.resolve();
  }),
  nativeAudioSeek: vi.fn((timeSec: number) => {
    emitEngine({ event: "seeked", data: { sec: timeSec } });
    emitEngine({ event: "timeUpdate", data: { sec: timeSec } });
    return Promise.resolve();
  }),
  nativeAudioSetRate: vi.fn(() => Promise.resolve()),
  nativeAudioSnapshot: vi.fn(() =>
    Promise.resolve({
      playing: false,
      currentTimeSec: 1.5,
      durationSec: 10,
      rate: 1,
      path: "/tmp/a.wav",
    }),
  ),
  nativeAudioStop: vi.fn(() => Promise.resolve()),
}));

import {
  nativeAudioLoad,
  nativeAudioPlay,
  nativeAudioPause,
  nativeAudioSeek,
  nativeAudioSetRate,
  nativeAudioStop,
} from "../../../tauri/nativeAudioApi";

describe("nativeAudioPlaybackTransport", () => {
  beforeEach(() => {
    lastChannel = null;
    vi.mocked(nativeAudioLoad).mockImplementation(
      (path: string, durationSec: number, onEvent: FakeChannel) => {
        lastChannel = onEvent;
        queueMicrotask(() => {
          onEvent.onmessage?.({
            event: "ready",
            data: { durationSec },
          });
        });
        return Promise.resolve({
          playing: false,
          currentTimeSec: 0,
          durationSec,
          rate: 1,
          path,
        });
      },
    );
    vi.mocked(nativeAudioPlay).mockImplementation(() => {
      emitEngine({ event: "playing" });
      return Promise.resolve();
    });
    vi.mocked(nativeAudioPause).mockImplementation(() => {
      emitEngine({ event: "paused" });
      return Promise.resolve();
    });
    vi.mocked(nativeAudioSeek).mockImplementation((timeSec: number) => {
      emitEngine({ event: "seeked", data: { sec: timeSec } });
      emitEngine({ event: "timeUpdate", data: { sec: timeSec } });
      return Promise.resolve();
    });
    vi.mocked(nativeAudioSetRate).mockImplementation(() => Promise.resolve());
    vi.mocked(nativeAudioStop).mockImplementation(() => Promise.resolve());
  });

  it("loads and mirrors play/pause/seek through Channel events", async () => {
    const t = createNativeAudioPlaybackTransport();
    const ready: number[] = [];
    t.subscribe({ onReady: (d) => ready.push(d) });
    await t.load({ mediaDiskPath: "/tmp/a.wav", durationSec: 12 });
    expect(nativeAudioLoad).toHaveBeenCalledWith(
      "/tmp/a.wav",
      12,
      expect.anything(),
    );
    expect(t.getDuration()).toBe(12);
    expect(t.kind).toBe("native");
    await vi.waitFor(() => {
      expect(ready.length).toBeGreaterThan(0);
    });

    await t.play();
    expect(nativeAudioPlay).toHaveBeenCalled();
    expect(t.isPlaying()).toBe(true);

    await t.seek(3.25);
    expect(nativeAudioSeek).toHaveBeenCalledWith(3.25);
    expect(t.getCurrentTime()).toBe(3.25);

    await t.setRate(1.25);
    expect(nativeAudioSetRate).toHaveBeenCalledWith(1.25);

    await t.pause();
    expect(nativeAudioPause).toHaveBeenCalled();
    expect(t.isPlaying()).toBe(false);

    await t.dispose();
    expect(nativeAudioStop).toHaveBeenCalled();
  });

  it("does not mark playing until Playing event (no optimistic race)", async () => {
    const deferred: { resolve: (() => void) | null } = { resolve: null };
    vi.mocked(nativeAudioPlay).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          deferred.resolve = resolve;
        }),
    );

    const t = createNativeAudioPlaybackTransport();
    await t.load({ mediaDiskPath: "/tmp/a.wav", durationSec: 10 });
    const plays: number[] = [];
    const pauses: number[] = [];
    t.subscribe({
      onPlay: () => plays.push(1),
      onPause: () => pauses.push(1),
    });

    const playPromise = t.play();
    await new Promise((r) => setTimeout(r, 20));
    expect(t.isPlaying()).toBe(false);
    expect(plays).toEqual([]);
    expect(pauses).toEqual([]);

    deferred.resolve?.();
    await playPromise;
    emitEngine({ event: "playing" });
    expect(t.isPlaying()).toBe(true);
    expect(plays).toEqual([1]);
    expect(pauses).toEqual([]);
    await t.dispose();
  });

  it("maps Ended to onFinish and clears playing", async () => {
    const t = createNativeAudioPlaybackTransport();
    await t.load({ mediaDiskPath: "/tmp/a.wav", durationSec: 5 });
    await t.play();
    const finishes: number[] = [];
    t.subscribe({ onFinish: () => finishes.push(1) });
    emitEngine({ event: "timeUpdate", data: { sec: 5 } });
    emitEngine({ event: "ended" });
    expect(t.isPlaying()).toBe(false);
    expect(finishes).toEqual([1]);
    await t.dispose();
  });

  it("transportAsMediaSink exposes play/pause/seek for dispatch", async () => {
    const t = createNativeAudioPlaybackTransport();
    await t.load({ mediaDiskPath: "/x", durationSec: 5 });
    const sink = transportAsMediaSink(t);
    await sink.play();
    expect(t.isPlaying()).toBe(true);
    sink.setTime(2);
    await vi.waitFor(() => {
      expect(nativeAudioSeek).toHaveBeenCalledWith(2);
    });
    sink.pause();
    await vi.waitFor(() => {
      expect(t.isPlaying()).toBe(false);
    });
  });
});

describe("resolveMediaPlaybackHost", () => {
  it("prefers native transport over WaveSurfer", async () => {
    const t = createNativeAudioPlaybackTransport();
    await t.load({ mediaDiskPath: "/x", durationSec: 5 });
    const ws = {
      play: vi.fn(),
      pause: vi.fn(),
      setTime: vi.fn(),
      getCurrentTime: vi.fn(() => 99),
      isPlaying: vi.fn(() => false),
      setPlaybackRate: vi.fn(),
    };
    const host = resolveMediaPlaybackHost(ws as never, t);
    expect(host).not.toBeNull();
    await host!.play();
    expect(nativeAudioPlay).toHaveBeenCalled();
    expect(ws.play).not.toHaveBeenCalled();
    expect(host!.getCurrentTime()).toBe(0);
  });

  it("returns null without transport when requireTransport (desktop default)", () => {
    const ws = {
      play: vi.fn(),
      pause: vi.fn(),
      setTime: vi.fn(),
      getCurrentTime: vi.fn(() => 4),
      isPlaying: vi.fn(() => true),
      setPlaybackRate: vi.fn(),
    };
    expect(
      resolveMediaPlaybackHost(ws as never, null, { requireTransport: true }),
    ).toBeNull();
  });

  it("awaits native seek before returning from host.setTime", async () => {
    const t = createNativeAudioPlaybackTransport();
    await t.load({ mediaDiskPath: "/x", durationSec: 5 });
    const host = resolveMediaPlaybackHost(null, t, { requireTransport: true });
    expect(host).not.toBeNull();
    await host!.setTime(2.5);
    expect(nativeAudioSeek).toHaveBeenCalledWith(2.5);
    expect(t.getCurrentTime()).toBe(2.5);
  });
});
