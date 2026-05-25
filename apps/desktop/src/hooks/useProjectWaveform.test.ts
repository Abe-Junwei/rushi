import { describe, expect, it } from "vitest";
import { parseSegmentRegionUid, segmentRegionId } from "../utils/waveformRegionId";

describe("segmentRegionId / parseSegmentRegionUid", () => {
  it("round-trips stable segment uid", () => {
    const uid = "8f3c2b1a-4d5e-6f7a-8b9c-0d1e2f3a4b5c";
    expect(parseSegmentRegionUid(segmentRegionId(uid))).toBe(uid);
  });

  it("rejects non-segment ids", () => {
    expect(parseSegmentRegionUid("other")).toBeNull();
    expect(parseSegmentRegionUid("rushi-seg-")).toBeNull();
  });
});
