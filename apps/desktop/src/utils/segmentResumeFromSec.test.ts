import { describe, expect, it } from "vitest";
import {
  resolveSegmentResumeFromSec,
  resolveStickySegmentSpaceFromSec,
} from "./segmentResumeFromSec";

const seg = { start_sec: 10, end_sec: 20 };

describe("resolveSegmentResumeFromSec", () => {
  it("uses explicit fromSec when provided", () => {
    expect(
      resolveSegmentResumeFromSec({
        segment: seg,
        targetIdx: 0,
        explicitFromSec: 14,
        autoStoppedIdx: 0,
        pausedAnchor: { idx: 0, timeSec: 12 },
      }),
    ).toBe(14);
  });

  it("replays from segment start after natural end auto-stop", () => {
    expect(
      resolveSegmentResumeFromSec({
        segment: seg,
        targetIdx: 0,
        autoStoppedIdx: 0,
        pausedAnchor: null,
      }),
    ).toBe(10);
  });

  it("resumes from pause anchor when not auto-stopped", () => {
    expect(
      resolveSegmentResumeFromSec({
        segment: seg,
        targetIdx: 2,
        autoStoppedIdx: null,
        pausedAnchor: { idx: 2, timeSec: 16.5 },
      }),
    ).toBe(16.5);
  });

  it("returns undefined when neither sticky intent matches", () => {
    expect(
      resolveSegmentResumeFromSec({
        segment: seg,
        targetIdx: 0,
        autoStoppedIdx: 3,
        pausedAnchor: { idx: 1, timeSec: 12 },
      }),
    ).toBeUndefined();
  });
});

describe("resolveStickySegmentSpaceFromSec", () => {
  it("forces segment start when display is at or past end", () => {
    expect(resolveStickySegmentSpaceFromSec({ segment: seg, displaySec: 20 })).toBe(10);
    expect(resolveStickySegmentSpaceFromSec({ segment: seg, displaySec: 19.99 })).toBe(10);
    expect(resolveStickySegmentSpaceFromSec({ segment: seg, displaySec: 25 })).toBe(10);
  });

  it("does not force start while still inside the segment", () => {
    expect(resolveStickySegmentSpaceFromSec({ segment: seg, displaySec: 15 })).toBeUndefined();
    expect(resolveStickySegmentSpaceFromSec({ segment: seg, displaySec: 10 })).toBeUndefined();
  });
});
