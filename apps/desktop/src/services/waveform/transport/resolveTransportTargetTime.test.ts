import { describe, expect, it } from "vitest";
import {
  resolveSegmentPlayFrom,
  resolveSegmentPlayFromForMode,
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
        authoritySec: 11,
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
        authoritySec: 14.5,
      }),
    ).toEqual({ kind: "resumeSkipSeek" });
  });

  it("resumes without seek when display lags raw slightly inside segment", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 14.7,
        authoritySec: 15.0,
      }),
    ).toEqual({ kind: "resumeSkipSeek" });
  });

  it("resumes without seek when display leads raw slightly inside segment", () => {
    // Native display interpolation leads TimeUpdate; seeking to display would
    // yank media forward, while seeking to a lagging pause anchor rewinds.
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 15.2,
        authoritySec: 15.0,
      }),
    ).toEqual({ kind: "resumeSkipSeek" });
  });

  it("skips seek when lagging pause fromSec is behind raw inside segment", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        fromSec: 15.0,
        displaySec: 15.2,
        authoritySec: 15.2,
      }),
    ).toEqual({ kind: "resumeSkipSeek" });
  });

  it("seeks to display when raw is stale inside segment", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 10,
        authoritySec: 14.5,
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

  it("resumes without seek when display and raw are past segment end", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 25,
        authoritySec: 25,
      }),
    ).toEqual({ kind: "resumeSkipSeek" });
  });

  it("seeks to display when past segment end and raw is stale", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 25,
        authoritySec: 2,
      }),
    ).toEqual({ kind: "seek", timeSec: 25 });
  });

  it("seeks to segment start when display is before the segment", () => {
    expect(
      resolveSegmentPlayFrom({
        segment: seg,
        displaySec: 2,
        authoritySec: 2,
      }),
    ).toEqual({ kind: "seek", timeSec: 10 });
  });
});

describe("resolveSegmentPlayFromForMode", () => {
  it("scoped play restarts a distant target while continue mode preserves gap-after", () => {
    const input = {
      segment: seg,
      displaySec: 3600,
      authoritySec: 3600,
    };
    expect(resolveSegmentPlayFromForMode(input, "scoped")).toEqual({
      kind: "seek",
      timeSec: 10,
    });
    expect(resolveSegmentPlayFromForMode(input, "resumeOrContinue")).toEqual({
      kind: "resumeSkipSeek",
    });
  });

  it("scoped play keeps explicit and in-segment resume positions", () => {
    expect(
      resolveSegmentPlayFromForMode(
        { segment: seg, fromSec: 16, displaySec: 3600, authoritySec: 3600 },
        "scoped",
      ),
    ).toEqual({ kind: "seek", timeSec: 16 });
    expect(
      resolveSegmentPlayFromForMode(
        { segment: seg, displaySec: 15, authoritySec: 15 },
        "scoped",
      ),
    ).toEqual({ kind: "resumeSkipSeek" });
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
