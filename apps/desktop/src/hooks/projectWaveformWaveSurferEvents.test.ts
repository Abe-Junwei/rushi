import { describe, expect, it } from "vitest";
import source from "./projectWaveformWaveSurferEvents.ts?raw";

describe("projectWaveformWaveSurferEvents", () => {
  it("does not schedule band paint on playing timeupdate (audioprocess drives viewport frame)", () => {
    expect(source).toMatch(/if \(ws\.isPlaying\(\)\) \{\s*return;\s*\}/);
    expect(source).toContain('ws.on("audioprocess"');
  });

  it("primes visual clock on audioprocess; syncs playhead on paused seeking only", () => {
    expect(source).toContain("optsRef.current.onWsAudioprocessRef?.current?.(t)");
    expect(source).toContain('ws.on("seeking"');
    expect(source).toMatch(/if \(!ws\.isPlaying\(\)\) \{[\s\S]*syncDisplayPlayheadAfterSeekRef/);
    expect(source).not.toContain("shouldSuppressSeekingPlayheadSync");
  });

  it("does not wrap requestWaveformSegmentBandPaint in requestAnimationFrame (S6)", () => {
    expect(source).toContain("requestWaveformSegmentBandPaint()");
    expect(source).not.toMatch(
      /requestAnimationFrame\s*\(\s*(?:\(\)\s*=>\s*)?\{[\s\S]{0,240}requestWaveformSegmentBandPaint/,
    );
    expect(source).toMatch(
      /const scheduleSegmentBandPaint = \(\) => \{\s*requestWaveformSegmentBandPaint\(\);\s*\};/,
    );
  });
});
