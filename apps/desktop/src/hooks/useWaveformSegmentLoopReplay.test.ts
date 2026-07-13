import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWaveformSegmentLoopReplay } from "./useWaveformSegmentLoopReplay";
import type WaveSurfer from "wavesurfer.js";

describe("useWaveformSegmentLoopReplay", () => {
  it("restarts from segment start with loop:true (not unbounded past-end play)", () => {
    const handlers = new Map<string, Array<() => void>>();
    const ws = {
      isPlaying: () => false,
      on: vi.fn((event: string, cb: () => void) => {
        const list = handlers.get(event) ?? [];
        list.push(cb);
        handlers.set(event, list);
        return () => {};
      }),
    } as unknown as WaveSurfer;
    const playSegmentAtIndex = vi.fn(async () => {});

    renderHook(() =>
      useWaveformSegmentLoopReplay({
        wsRef: { current: ws },
        isReady: true,
        segmentLoopPlayback: true,
        segmentLoopPlaybackRef: { current: true },
        resolvePlayheadSec: () => 19.98,
        resolveSelectedPlaybackRange: () => ({ start: 10, end: 20 }),
        resolveEffectiveSelectedIdx: () => 0,
        playSegmentAtIndex,
      }),
    );

    for (const cb of handlers.get("pause") ?? []) cb();
    // rAF scheduled — flush it
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(playSegmentAtIndex).toHaveBeenCalledWith(0, {
          fromSec: 10,
          loop: true,
        });
        resolve();
      });
    });
  });

  it("does not replay when playhead is mid-segment", () => {
    const handlers = new Map<string, Array<() => void>>();
    const ws = {
      isPlaying: () => false,
      on: vi.fn((event: string, cb: () => void) => {
        const list = handlers.get(event) ?? [];
        list.push(cb);
        handlers.set(event, list);
        return () => {};
      }),
    } as unknown as WaveSurfer;
    const playSegmentAtIndex = vi.fn(async () => {});

    renderHook(() =>
      useWaveformSegmentLoopReplay({
        wsRef: { current: ws },
        isReady: true,
        segmentLoopPlayback: true,
        segmentLoopPlaybackRef: { current: true },
        resolvePlayheadSec: () => 15,
        resolveSelectedPlaybackRange: () => ({ start: 10, end: 20 }),
        resolveEffectiveSelectedIdx: () => 0,
        playSegmentAtIndex,
      }),
    );

    for (const cb of handlers.get("pause") ?? []) cb();
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(playSegmentAtIndex).not.toHaveBeenCalled();
        resolve();
      });
    });
  });
});
