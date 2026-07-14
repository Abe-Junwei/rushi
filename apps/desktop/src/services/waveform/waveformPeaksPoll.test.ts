import { describe, expect, it } from "vitest";
import { peaksAllLevelsReady, resolvePeaksPollTimeoutMs, resolvePeaksPollDurationSec } from "./waveformPeaksPoll";
import type { WaveformPeaksStatus } from "../../tauri/waveformPeaksApi";

function status(levels: Array<{ level: number; exists: boolean }>): WaveformPeaksStatus {
  return {
    levels: levels.map((l) => ({
      level: l.level,
      pixelsPerSecond: 20,
      path: `/tmp/L${l.level}.dat`,
      exists: l.exists,
    })),
    sampleRate: null,
    durationSec: null,
    generating: false,
  };
}

describe("waveformPeaksPoll", () => {
  it("detects when all peak levels exist", () => {
    expect(
      peaksAllLevelsReady(
        status([
          { level: 0, exists: true },
          { level: 1, exists: true },
          { level: 2, exists: true },
        ]),
      ),
    ).toBe(true);
    expect(
      peaksAllLevelsReady(
        status([
          { level: 0, exists: true },
          { level: 1, exists: false },
          { level: 2, exists: false },
        ]),
      ),
    ).toBe(false);
  });

  it("scales poll timeout with media duration", () => {
    expect(resolvePeaksPollTimeoutMs(0)).toBe(120_000);
    expect(resolvePeaksPollTimeoutMs(48 * 60)).toBe(900_000);
  });

  it("prefers the longer of media and status duration for poll budget", () => {
    expect(resolvePeaksPollDurationSec(0, 13_230)).toBe(13_230);
    expect(resolvePeaksPollDurationSec(13_230, null)).toBe(13_230);
    expect(resolvePeaksPollDurationSec(100, 50)).toBe(100);
  });
});
