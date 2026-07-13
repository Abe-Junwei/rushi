import { describe, expect, it, vi } from "vitest";
import { createNativeAudioPlaybackTransport } from "../services/waveform/transport/nativeAudioPlaybackTransport";
import { resolveMediaPlaybackHost } from "../services/waveform/transport/resolveMediaPlaybackHost";
import type { NativeAudioEvent } from "../tauri/nativeAudioApi";

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

vi.mock("../tauri/nativeAudioApi", () => ({
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
    lastChannel?.onmessage?.({ event: "playing" });
    return Promise.resolve();
  }),
  nativeAudioPause: vi.fn(() => {
    lastChannel?.onmessage?.({ event: "paused" });
    return Promise.resolve();
  }),
  nativeAudioSeek: vi.fn((timeSec: number) => {
    lastChannel?.onmessage?.({ event: "seeked", data: { sec: timeSec } });
    return Promise.resolve();
  }),
  nativeAudioSetRate: vi.fn(() => Promise.resolve()),
  nativeAudioStop: vi.fn(() => Promise.resolve()),
}));

/**
 * Phase E: Space / global / segment entry points must resolve the same native sink.
 */
describe("playback entry host convergence", () => {
  it("three entry resolvers share the same gateHost object", async () => {
    const transport = createNativeAudioPlaybackTransport();
    await transport.load({ mediaDiskPath: "/tmp/a.wav", durationSec: 10 });

    const resolveHost = () =>
      resolveMediaPlaybackHost(null, transport, { requireTransport: true });

    const spaceHost = resolveHost();
    const globalHost = resolveHost();
    const segmentHost = resolveHost();

    expect(spaceHost).not.toBeNull();
    expect(globalHost).not.toBeNull();
    expect(segmentHost).not.toBeNull();
    expect(spaceHost!.gateHost).toBe(transport);
    expect(globalHost!.gateHost).toBe(spaceHost!.gateHost);
    expect(segmentHost!.gateHost).toBe(spaceHost!.gateHost);
    expect(spaceHost!.isNative).toBe(true);

    await spaceHost!.play();
    expect(transport.isPlaying()).toBe(true);
    await globalHost!.pause();
    expect(transport.isPlaying()).toBe(false);
  });
});
