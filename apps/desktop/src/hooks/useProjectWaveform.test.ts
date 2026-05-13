import { describe, expect, it } from "vitest";
import { parseSegmentRegionId, segmentRegionId } from "../utils/waveformRegionId";

describe("segmentRegionId / parseSegmentRegionId", () => {
  it("round-trips indices", () => {
    expect(parseSegmentRegionId(segmentRegionId(0))).toBe(0);
    expect(parseSegmentRegionId(segmentRegionId(12))).toBe(12);
  });

  it("rejects foreign ids", () => {
    expect(parseSegmentRegionId("other")).toBeNull();
    expect(parseSegmentRegionId("rushi-seg-x")).toBeNull();
  });
});
