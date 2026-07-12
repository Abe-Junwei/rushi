/**
 * Zero-PCM (silent) WAV generator for the AudioKeepAlive session anchor.
 *
 * Why: macOS 26 WKWebView routes <audio> through the GPU process and activates
 * the shared CoreAudio session via a *synchronous* WebContent→GPU IPC
 * (RemoteAudioSession::tryToSetActive). Every inactive→active transition can
 * nest that sync wait and deadlock WebContent. Keeping one silent element
 * playing forever holds the session active, so WaveSurfer's play/pause never
 * triggers a cold reactivation.
 *
 * The content is all-zero PCM (true silence), so the element is inaudible while
 * still counting as "producing audio" (keeps canProduceAudio true).
 */

const RIFF = 0x52494646; // "RIFF"
const WAVE = 0x57415645; // "WAVE"
const FMT = 0x666d7420; // "fmt "
const DATA = 0x64617461; // "data"

export interface SilentWavOptions {
  /** Sample rate in Hz. Small is fine — content is silent. */
  sampleRate?: number;
  /** Number of channels. Mono keeps the buffer tiny. */
  channels?: number;
  /** Buffer length in seconds (looped by the element). */
  durationSec?: number;
}

const DEFAULTS: Required<SilentWavOptions> = {
  sampleRate: 8000,
  channels: 1,
  durationSec: 1,
};

/**
 * Build the raw bytes of a 16-bit PCM silent WAV file. Pure and DOM-free so it
 * is unit-testable without URL.createObjectURL (unavailable in jsdom).
 */
export function buildSilentWavBytes(options?: SilentWavOptions): Uint8Array {
  const { sampleRate, channels, durationSec } = { ...DEFAULTS, ...options };
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const frameCount = Math.max(1, Math.round(sampleRate * durationSec));
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  view.setUint32(0, RIFF, false);
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, WAVE, false);
  view.setUint32(12, FMT, false);
  view.setUint32(16, 16, true); // fmt chunk size (PCM)
  view.setUint16(20, 1, true); // audioFormat = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, DATA, false);
  view.setUint32(40, dataSize, true);
  // PCM payload stays all-zero: true silence.

  return new Uint8Array(buffer);
}

/**
 * Create an object URL for a silent WAV Blob. Caller owns the URL and must
 * revoke it via URL.revokeObjectURL when the audio element is torn down.
 */
export function createSilentWavObjectUrl(options?: SilentWavOptions): string {
  const bytes = buildSilentWavBytes(options);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}
