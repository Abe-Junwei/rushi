import { describe, expect, it } from "vitest";
import { SEEK_SETTLE_WINDOW_MS } from "./waveformSeekSettle";

describe("waveformSeekSettle", () => {
  it("exposes a single positive post-seek settle window", () => {
    expect(Number.isFinite(SEEK_SETTLE_WINDOW_MS)).toBe(true);
    expect(SEEK_SETTLE_WINDOW_MS).toBeGreaterThan(0);
  });

  it("is the one source every settle guard imports (no re-split into 400/500/600)", () => {
    // Regression guard: the flicker returned whenever the native stale/settle guards,
    // the visual-clock grounding, and the follow-suppress used different durations or
    // anchors. They must all read this constant — keep it a single shared value.
    expect(SEEK_SETTLE_WINDOW_MS).toBe(500);
  });
});
