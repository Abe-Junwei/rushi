// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { bindProjectWaveformWaveSurferEvents } from "./projectWaveformWaveSurferEvents";
import { imperativePlayheadSyncSuppressUntil } from "../utils/waveformImperativePlayheadSync";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

type Handler = (t: number) => void;

function makeWs() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    on: vi.fn((event: string, cb: Handler) => {
      handlers.set(event, cb);
      return () => handlers.delete(event);
    }),
    getCurrentTime: () => 0,
    getDuration: () => 0,
    isPlaying: () => false,
  };
}

describe("projectWaveformWaveSurferEvents seeking dedup", () => {
  it("skips syncDisplayPlayheadAfterSeek when imperative suppress window is active", () => {
    const ws = makeWs();
    const syncDisplayPlayheadAfterSeek = vi.fn();
    const suppressUntilRef = { current: 0 };
    const optsRef = {
      current: {
        syncDisplayPlayheadAfterSeekRef: { current: syncDisplayPlayheadAfterSeek },
        imperativePlayheadSyncSuppressUntilRef: suppressUntilRef,
        selectionSeekChromeSuppressUntilRef: { current: 0 },
      } as UseProjectWaveformOptions,
    };

    bindProjectWaveformWaveSurferEvents({
      ws: ws as unknown as import("wavesurfer.js").default,
      disposed: () => false,
      mediaUrl: null,
      mediaDiskPath: null,
      optsRef,
      minPxPerSecRef: { current: 56 },
      lastTimeUiCommitRef: { current: 0 },
      lastTimeUiCommitMsRef: { current: 0 },
      pendingScrollLeftRef: { current: 0 },
      scrollNotifyRafRef: { current: 0 },
      pendingAppliedWaveformHeightRef: { current: null },
      appliedWaveformHeightRef: { current: 80 },
      syncTierScrollAfterRenderRef: { current: () => {} },
      setLoadError: vi.fn(),
      setIsReady: vi.fn(),
      setIsPlaying: vi.fn(),
      setDuration: vi.fn(),
      setCurrentTime: vi.fn(),
    });

    const seeking = ws.handlers.get("seeking");
    expect(seeking).toBeTypeOf("function");

    suppressUntilRef.current = imperativePlayheadSyncSuppressUntil(performance.now());
    seeking?.(18.5);
    expect(syncDisplayPlayheadAfterSeek).not.toHaveBeenCalled();

    suppressUntilRef.current = 0;
    seeking?.(19);
    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledTimes(1);
    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledWith(19);
  });
});
