import { describe, expect, it } from "vitest";
import {
  armSegmentPlaybackSession,
  isActiveSegmentPlaybackBound,
  segmentPlaybackReachedEnd,
} from "./segmentPlaybackBound";

describe("segmentPlaybackBound", () => {
  it("detects end within epsilon", () => {
    expect(segmentPlaybackReachedEnd(9.99, 10)).toBe(true);
    expect(segmentPlaybackReachedEnd(9.98, 10)).toBe(false);
    expect(segmentPlaybackReachedEnd(10.2, 10)).toBe(true);
  });

  it("matches bound generation", () => {
    const bound = { startSec: 4, endSec: 10, generation: 2, armed: false };
    expect(isActiveSegmentPlaybackBound(bound, 2)).toBe(true);
    expect(isActiveSegmentPlaybackBound(bound, 3)).toBe(false);
    expect(isActiveSegmentPlaybackBound(null, 2)).toBe(false);
  });

  it("arms after seek to start when replaying from segment end", () => {
    const session = { startSec: 4, endSec: 10, generation: 1, armed: false };
    expect(armSegmentPlaybackSession(session, 10)).toBe(false);
    expect(session.armed).toBe(false);
    expect(armSegmentPlaybackSession(session, 4)).toBe(true);
    expect(session.armed).toBe(true);
  });

  it("arms on clear overshoot so sparse frames still stop", () => {
    const session = { startSec: 4, endSec: 10, generation: 1, armed: false };
    expect(armSegmentPlaybackSession(session, 10.05)).toBe(true);
    expect(session.armed).toBe(true);
  });
});
