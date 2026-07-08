import { describe, expect, it } from "vitest";
import {
  IMPERATIVE_PLAYHEAD_SYNC_SUPPRESS_MS,
  imperativePlayheadSyncSuppressUntil,
  shouldSuppressSeekingPlayheadSync,
} from "./waveformImperativePlayheadSync";

describe("waveformImperativePlayheadSync", () => {
  it("suppresses seeking sync within the imperative window", () => {
    const now = 1000;
    const until = imperativePlayheadSyncSuppressUntil(now);
    expect(until).toBe(now + IMPERATIVE_PLAYHEAD_SYNC_SUPPRESS_MS);
    expect(shouldSuppressSeekingPlayheadSync(now + 10, until)).toBe(true);
    expect(shouldSuppressSeekingPlayheadSync(until, until)).toBe(false);
  });
});
