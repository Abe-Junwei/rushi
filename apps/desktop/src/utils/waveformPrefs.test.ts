import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clampPxPerSec } from "./pxPerSec";
import { readStoredWaveformPxPerSec, writeStoredWaveformPxPerSec } from "./waveformPrefs";

describe("waveformPrefs localStorage", () => {
  const mem: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(mem)) delete mem[k];
  });

  it("round-trips px/s after clamp", () => {
    writeStoredWaveformPxPerSec(120);
    expect(readStoredWaveformPxPerSec()).toBe(120);
  });

  it("clamps invalid stored values on read", () => {
    localStorage.setItem("rushi.p1.waveformPxPerSec", "99999");
    expect(readStoredWaveformPxPerSec()).toBe(clampPxPerSec(99999));
  });
});
