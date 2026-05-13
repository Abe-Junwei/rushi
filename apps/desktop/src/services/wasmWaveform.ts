/**
 * Thin TypeScript wrapper around @rushi/wasm-waveform.
 *
 * Handles async init() (required by wasm-bindgen --target web),
 * decodes audio into PCM f32, and delegates drawing to the Wasm module.
 */

import init, { draw_waveform, draw_waveform_simple } from "@rushi/wasm-waveform";

let initPromise: Promise<unknown> | null = null;

/** Initialise the Wasm module once; safe to call multiple times. */
export async function initWasmWaveform(): Promise<void> {
  if (initPromise) return initPromise as Promise<void>;
  initPromise = init();
  await initPromise;
}

/** Decode an ArrayBuffer (WAV / mp3 / ogg / webm) into mono f32 PCM via Web Audio API. */
export async function decodeAudioToF32(
  arrayBuffer: ArrayBuffer,
  sampleRate = 44100,
): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate });
  const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
  await ctx.close();

  const ch0 = audioBuf.getChannelData(0);
  if (audioBuf.numberOfChannels === 1) {
    return ch0;
  }
  // Average to mono
  const ch1 = audioBuf.getChannelData(1);
  const mono = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) {
    mono[i] = (ch0[i] + ch1[i]) * 0.5;
  }
  return mono;
}

/** High-level: decode audio file then draw waveform onto canvas. */
export async function renderWaveform(
  canvasId: string,
  audioArrayBuffer: ArrayBuffer,
  width: number,
  height: number,
  color = "#3D4F5D",
  barWidth = 2,
  gap = 1,
): Promise<void> {
  await initWasmWaveform();
  const samples = await decodeAudioToF32(audioArrayBuffer);
  draw_waveform(canvasId, samples, width, height, color, barWidth, gap);
}

/** Simple variant with sensible defaults. */
export async function renderWaveformSimple(
  canvasId: string,
  audioArrayBuffer: ArrayBuffer,
  width: number,
  height: number,
): Promise<void> {
  await initWasmWaveform();
  const samples = await decodeAudioToF32(audioArrayBuffer);
  draw_waveform_simple(canvasId, samples, width, height);
}

export { draw_waveform, draw_waveform_simple };
