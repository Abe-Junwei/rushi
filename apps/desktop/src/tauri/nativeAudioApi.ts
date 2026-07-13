import { Channel, invoke } from "@tauri-apps/api/core";

export type NativeAudioSnapshot = {
  playing: boolean;
  currentTimeSec: number;
  durationSec: number;
  rate: number;
  path: string;
};

/** Mirrors Rust `NativeAudioEvent` serde contract (tag=event, content=data, camelCase). */
export type NativeAudioEvent =
  | { event: "ready"; data: { durationSec: number } }
  | { event: "playing" }
  | { event: "paused" }
  | { event: "seeked"; data: { sec: number } }
  | { event: "timeUpdate"; data: { sec: number } }
  | { event: "ended" }
  | { event: "underrun"; data: { consecutive: number } }
  | { event: "deviceChanged"; data: { message: string } }
  | { event: "error"; data: { message: string } };

export async function nativeAudioLoad(
  path: string,
  durationSec: number,
  onEvent: Channel<NativeAudioEvent>,
): Promise<NativeAudioSnapshot> {
  return invoke<NativeAudioSnapshot>("native_audio_load", {
    path,
    durationSec,
    onEvent,
  });
}

export async function nativeAudioPlay(): Promise<void> {
  return invoke<void>("native_audio_play");
}

export async function nativeAudioPause(): Promise<void> {
  return invoke<void>("native_audio_pause");
}

export async function nativeAudioSeek(timeSec: number): Promise<void> {
  return invoke<void>("native_audio_seek", { timeSec });
}

export async function nativeAudioSetRate(rate: number): Promise<void> {
  return invoke<void>("native_audio_set_rate", { rate });
}

/** Debug-only; UI clock should prefer Channel events. */
export async function nativeAudioSnapshot(): Promise<NativeAudioSnapshot> {
  return invoke<NativeAudioSnapshot>("native_audio_snapshot");
}

export async function nativeAudioStop(): Promise<void> {
  return invoke<void>("native_audio_stop");
}
