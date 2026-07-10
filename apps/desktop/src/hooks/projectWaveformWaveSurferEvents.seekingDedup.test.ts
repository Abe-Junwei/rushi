// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { bindProjectWaveformWaveSurferEvents } from "./projectWaveformWaveSurferEvents";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

type Handler = (t: number) => void;

function makeWs(isPlaying = false) {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    on: vi.fn((event: string, cb: Handler) => {
      handlers.set(event, cb);
      return () => handlers.delete(event);
    }),
    getCurrentTime: () => 0,
    getDuration: () => 0,
    isPlaying: () => isPlaying,
  };
}

function bindSeekingHandler(
  ws: ReturnType<typeof makeWs>,
  syncDisplayPlayheadAfterSeek: ReturnType<typeof vi.fn>,
) {
  const setCurrentTime = vi.fn();
  const optsRef = {
    current: {
      mediaUrl: null,
      segments: [],
      selectedIdx: -1,
      syncDisplayPlayheadAfterSeekRef: { current: syncDisplayPlayheadAfterSeek },
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
    setCurrentTime,
  });

  return { seeking: ws.handlers.get("seeking"), setCurrentTime };
}

describe("projectWaveformWaveSurferEvents seeking", () => {
  it("syncs display playhead on paused seeking (WS-only seek path)", () => {
    const syncDisplayPlayheadAfterSeek = vi.fn();
    const { seeking, setCurrentTime } = bindSeekingHandler(makeWs(false), syncDisplayPlayheadAfterSeek);

    expect(seeking).toBeTypeOf("function");
    seeking?.(19);

    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledTimes(1);
    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledWith(19);
    expect(setCurrentTime).toHaveBeenCalledWith(19);
  });

  it("does not re-sync display playhead on playing seeking", () => {
    const syncDisplayPlayheadAfterSeek = vi.fn();
    const { seeking, setCurrentTime } = bindSeekingHandler(makeWs(true), syncDisplayPlayheadAfterSeek);

    seeking?.(19);

    expect(syncDisplayPlayheadAfterSeek).not.toHaveBeenCalled();
    expect(setCurrentTime).toHaveBeenCalledWith(19);
  });
});
