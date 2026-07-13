import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  endMediaPlay,
  enqueueMediaOp,
  isMediaPlayInFlight,
  MEDIA_PAUSE_TO_PLAY_GAP_MS,
  noteMediaPaused,
  resetMediaPauseClockForTests,
  runGatedMediaPause,
  runGatedMediaPlay,
  runGatedMediaSeek,
  tryBeginMediaPlay,
} from "./mediaPlayGate";

describe("mediaPlayGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a second begin while the first play is held", async () => {
    const host = {};
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = runGatedMediaPlay(host, () => pending);
    expect(isMediaPlayInFlight(host)).toBe(true);
    expect(await runGatedMediaPlay(host, () => undefined)).toBe("busy");
    expect(tryBeginMediaPlay(host)).toBe(false);

    release();
    await expect(first).resolves.toBe("ok");
    expect(isMediaPlayInFlight(host)).toBe(false);
  });

  it("releases the gate when play throws", async () => {
    const host = {};
    await expect(
      runGatedMediaPlay(host, () => {
        throw new Error("play failed");
      }),
    ).rejects.toThrow("play failed");
    expect(isMediaPlayInFlight(host)).toBe(false);
    expect(await runGatedMediaPlay(host, () => undefined)).toBe("ok");
  });

  it("tryBegin / end are paired", () => {
    const host = {};
    expect(tryBeginMediaPlay(host)).toBe(true);
    expect(tryBeginMediaPlay(host)).toBe(false);
    endMediaPlay(host);
    expect(tryBeginMediaPlay(host)).toBe(true);
    endMediaPlay(host);
  });

  it("gates are per host object", async () => {
    const a = {};
    const b = {};
    const playA = vi.fn(() => undefined);
    const playB = vi.fn(() => undefined);
    expect(await runGatedMediaPlay(a, playA)).toBe("ok");
    expect(await runGatedMediaPlay(b, playB)).toBe("ok");
    expect(playA).toHaveBeenCalledOnce();
    expect(playB).toHaveBeenCalledOnce();
  });

  it("serializes pause then play with a minimum gap", async () => {
    const host = {};
    const order: string[] = [];
    const pauseP = runGatedMediaPause(host, () => {
      order.push("pause");
    });
    const playP = runGatedMediaPlay(host, () => {
      order.push("play");
    });

    await pauseP;
    expect(order).toEqual(["pause"]);
    expect(order).not.toContain("play");

    await vi.advanceTimersByTimeAsync(MEDIA_PAUSE_TO_PLAY_GAP_MS - 1);
    expect(order).toEqual(["pause"]);

    await vi.advanceTimersByTimeAsync(1);
    await playP;
    expect(order).toEqual(["pause", "play"]);
  });

  it("noteMediaPaused forces the next play to wait", async () => {
    const host = {};
    noteMediaPaused(host);
    const play = vi.fn(() => undefined);
    const playP = runGatedMediaPlay(host, play);
    await Promise.resolve();
    expect(play).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(MEDIA_PAUSE_TO_PLAY_GAP_MS);
    await playP;
    expect(play).toHaveBeenCalledOnce();
  });

  it("native gap=0 skips pause→play delay", async () => {
    const host = {};
    noteMediaPaused(host);
    const play = vi.fn(() => undefined);
    const playP = runGatedMediaPlay(host, play, { pauseToPlayGapMs: 0 });
    await playP;
    expect(play).toHaveBeenCalledOnce();
  });

  it("seek does not wait for the pause→play gap", async () => {
    const host = {};
    noteMediaPaused(host);
    const seek = vi.fn(() => undefined);
    await runGatedMediaSeek(host, seek);
    expect(seek).toHaveBeenCalledOnce();
  });

  it("enqueueMediaOp runs ops in order on one host", async () => {
    const host = {};
    resetMediaPauseClockForTests(host);
    const order: number[] = [];
    const a = enqueueMediaOp(host, "seek", async () => {
      order.push(1);
      await delayFake(10);
      order.push(2);
    });
    const b = enqueueMediaOp(host, "seek", () => {
      order.push(3);
    });
    await vi.advanceTimersByTimeAsync(10);
    await a;
    await b;
    expect(order).toEqual([1, 2, 3]);
  });
});

function delayFake(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
