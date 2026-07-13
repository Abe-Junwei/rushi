import { describe, expect, it } from "vitest";
import {
  resolveSegmentPauseFreezeSec,
  resolveSegmentResumeFromSec,
  resolveStickySegmentSpaceFromSec,
} from "./segmentResumeFromSec";

const seg = { start_sec: 10, end_sec: 20 };

describe("resolveSegmentPauseFreezeSec", () => {
  it("prefers the leading of display and authority", () => {
    expect(resolveSegmentPauseFreezeSec({ displaySec: 15.2, authoritySec: 15.0 })).toBe(15.2);
    expect(resolveSegmentPauseFreezeSec({ displaySec: 14.8, authoritySec: 15.0 })).toBe(15.0);
  });

  it("falls back to display when authority is absent", () => {
    expect(resolveSegmentPauseFreezeSec({ displaySec: 12 })).toBe(12);
  });
});

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

  it("forces start when display was visually rewound but media is still at end", () => {
    expect(
      resolveStickySegmentSpaceFromSec({
        segment: seg,
        displaySec: 10,
        authoritySec: 20,
      }),
    ).toBe(10);
    expect(
      resolveStickySegmentSpaceFromSec({
        segment: seg,
        displaySec: 10,
        authoritySec: 19.99,
      }),
    ).toBe(10);
  });

  it("does not force start when display and media are both inside", () => {
    expect(
      resolveStickySegmentSpaceFromSec({
        segment: seg,
        displaySec: 10,
        authoritySec: 10,
      }),
    ).toBeUndefined();
  });
});
