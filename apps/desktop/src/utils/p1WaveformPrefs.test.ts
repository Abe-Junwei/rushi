import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clampP1PxPerSec } from "./p1PxPerSec";
import { readStoredP1WaveformPxPerSec, writeStoredP1WaveformPxPerSec } from "./p1WaveformPrefs";

describe("p1WaveformPrefs localStorage", () => {
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
    writeStoredP1WaveformPxPerSec(120);
    expect(readStoredP1WaveformPxPerSec()).toBe(120);
  });

  it("clamps invalid stored values on read", () => {
    localStorage.setItem("rushi.p1.waveformPxPerSec", "99999");
    expect(readStoredP1WaveformPxPerSec()).toBe(clampP1PxPerSec(99999));
  });
});
