import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNativePlaybackController } from "./useNativePlaybackController";
import type { PlaybackTransport, PlaybackTransportEvents } from "../services/waveform/transport";

let subscribedHandlers: PlaybackTransportEvents | null = null;

const loadMock = vi.fn(() => {
  subscribedHandlers?.onReady?.(123);
  return Promise.resolve();
});
const disposeMock = vi.fn(() => Promise.resolve());

vi.mock("../services/waveform/transport", () => ({
  createNativeAudioPlaybackTransport: () =>
    ({
      kind: "native",
      load: loadMock,
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      setRate: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDisplayTime: vi.fn(() => 0),
      isPlaying: vi.fn(() => false),
      getDuration: vi.fn(() => 123),
      subscribe: (handlers: PlaybackTransportEvents) => {
        subscribedHandlers = handlers;
        return vi.fn();
      },
      dispose: disposeMock,
    }) satisfies PlaybackTransport,
}));

describe("useNativePlaybackController", () => {
  beforeEach(() => {
    subscribedHandlers = null;
    loadMock.mockClear();
    disposeMock.mockClear();
  });

  it("publishes native ready duration to layout ref and React duration state", async () => {
    const layoutDurationSecRef = { current: 0 };
    const setDuration = vi.fn();
    const setAudioReady = vi.fn();

    renderHook(() =>
      useNativePlaybackController({
        enabled: true,
        mediaDiskPath: "/tmp/a.wav",
        layoutDurationSecRef,
        peakCacheRef: { current: null },
        transportRef: { current: null },
        applyGlobalPlaybackRate: vi.fn(),
        lastTimeUiCommitRef: { current: 0 },
        setIsPlaying: vi.fn(),
        setDuration,
        setCurrentTime: vi.fn(),
        setLoadError: vi.fn(),
        setAudioReady,
        onTransportEpoch: vi.fn(),
      }),
    );

    await waitFor(() => expect(setAudioReady).toHaveBeenCalledWith(true));

    expect(layoutDurationSecRef.current).toBe(123);
    expect(setDuration).toHaveBeenCalledWith(123);
    expect(loadMock).toHaveBeenCalledWith({ mediaDiskPath: "/tmp/a.wav", durationSec: 0 });
  });
});
