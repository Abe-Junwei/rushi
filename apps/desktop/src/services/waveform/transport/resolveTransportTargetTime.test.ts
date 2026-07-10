import { describe, expect, it } from "vitest";
import {
  resolveSegmentPlayFrom,
  resolveSeekTargetTime,
  resolveSelectTransportSeekTime,
} from "./resolveTransportTargetTime";

const seg = { start_sec: 10, end_sec: 20 };

describe("resolveSegmentPlayFrom", () => {
  it("prefers explicit fromSec clamped into segment", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        fromSec: 16.5,
        displaySec: 11,
        rawMediaSec: 11,
      }),
    ).toEqual({ kind: "seek", timeSec: 16.5 });
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        fromSec: 100,
        displaySec: 11,
      }),
    ).toEqual({ kind: "seek", timeSec: 20 });
  });

  it("resumes without seek when raw≈display inside segment", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 14.48,
        rawMediaSec: 14.5,
      }),
    ).toEqual({ kind: "resumeSkipSeek" });
  });

  it("seeks to display when raw is stale inside segment", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 10,
        rawMediaSec: 14.5,
      }),
    ).toEqual({ kind: "seek", timeSec: 10 });
  });

  it("seeks to display when display is inside and raw is absent", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 15,
      }),
    ).toEqual({ kind: "seek", timeSec: 15 });
  });

  it("seeks to segment start when display and raw are outside", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 2,
        rawMediaSec: 2,
      }),
    ).toEqual({ kind: "seek", timeSec: 10 });
  });

  it("seeks to segment start when display is past segment end", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 25,
        rawMediaSec: 25,
      }),
    ).toEqual({ kind: "seek", timeSec: 10 });
  });
});

describe("resolveSeekTargetTime", () => {
  it("clamps into duration", () => {
    expect(resolveSeekTargetTime({ timeSec: -1, durationSec: 100 })).toBe(0);
    expect(resolveSeekTargetTime({ timeSec: 50, durationSec: 100 })).toBe(50);
    expect(resolveSeekTargetTime({ timeSec: 150, durationSec: 100 })).toBe(100);
  });

  it("allows any non-negative when duration unknown", () => {
    expect(resolveSeekTargetTime({ timeSec: 12, durationSec: 0 })).toBe(12);
  });
});

describe("resolveSelectTransportSeekTime", () => {
  it("returns null for none", () => {
    expect(
      resolveSelectTransportSeekTime({
        seekPolicy: "none",
        segment: seg,
      }),
    ).toBeNull();
  });

  it("returns segment start", () => {
    expect(
      resolveSelectTransportSeekTime({
        seekPolicy: "segmentStart",
        segment: seg,
      }),
    ).toBe(10);
  });

  it("clamps pointerTime into segment", () => {
    expect(
      resolveSelectTransportSeekTime({
        seekPolicy: "pointerTime",
        segment: seg,
        pointerTimeSec: 15.2,
      }),
    ).toBe(15.2);
    expect(
      resolveSelectTransportSeekTime({
        seekPolicy: "pointerTime",
        segment: seg,
        pointerTimeSec: 3,
      }),
    ).toBe(10);
  });
});
