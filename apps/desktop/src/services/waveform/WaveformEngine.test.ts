import { describe, expect, it } from "vitest";
import { WaveformEngine } from "./WaveformEngine";

describe("WaveformEngine", () => {
  it("notifies viewport subscribers on patch", () => {
    const engine = new WaveformEngine();
    const seen: number[] = [];
    engine.subscribeViewport((s) => {
      seen.push(s.pxPerSec);
    });
    engine.setPxPerSec(80);
    expect(seen).toContain(56);
    expect(seen[seen.length - 1]).toBe(80);
  });

  it("returns null peaks without cache", () => {
    const engine = new WaveformEngine();
    expect(engine.getPeaksForRender()).toBeNull();
  });
});
