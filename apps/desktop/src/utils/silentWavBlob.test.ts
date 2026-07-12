import { describe, expect, it } from "vitest";
import { buildSilentWavBytes } from "./silentWavBlob";

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer).getUint32(offset, true);
}

describe("buildSilentWavBytes", () => {
  it("emits a valid RIFF/WAVE PCM header", () => {
    const bytes = buildSilentWavBytes({
      sampleRate: 8000,
      channels: 1,
      durationSec: 1,
    });
    expect(ascii(bytes, 0, 4)).toBe("RIFF");
    expect(ascii(bytes, 8, 4)).toBe("WAVE");
    expect(ascii(bytes, 12, 4)).toBe("fmt ");
    expect(ascii(bytes, 36, 4)).toBe("data");
    // audioFormat = 1 (PCM), 16-bit
    expect(new DataView(bytes.buffer).getUint16(20, true)).toBe(1);
    expect(new DataView(bytes.buffer).getUint16(34, true)).toBe(16);
  });

  it("sizes the data chunk to sampleRate * duration * blockAlign", () => {
    const bytes = buildSilentWavBytes({
      sampleRate: 8000,
      channels: 1,
      durationSec: 1,
    });
    const dataSize = 8000 * 1 * 2; // 1s mono 16-bit
    expect(readUint32LE(bytes, 40)).toBe(dataSize);
    expect(readUint32LE(bytes, 4)).toBe(36 + dataSize);
    expect(bytes.length).toBe(44 + dataSize);
  });

  it("produces pure silence (all-zero PCM payload)", () => {
    const bytes = buildSilentWavBytes({ durationSec: 0.1 });
    const payload = bytes.subarray(44);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload.every((b) => b === 0)).toBe(true);
  });

  it("guarantees at least one frame for tiny durations", () => {
    const bytes = buildSilentWavBytes({
      sampleRate: 8000,
      channels: 1,
      durationSec: 0,
    });
    // 1 frame * 2 bytes
    expect(readUint32LE(bytes, 40)).toBe(2);
  });
});
