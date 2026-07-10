import { describe, expect, it } from "vitest";
import {
  formatMediaTime,
  parseMediaTimeInput,
  resolveSegmentPlaybackStartSec,
  segmentStartSec,
} from "./formatMediaTime";

describe("formatMediaTime", () => {
  it("formats sub-hour times", () => {
    expect(formatMediaTime(65)).toBe("1:05");
  });
});

describe("segmentStartSec", () => {
  it("uses min of bounds", () => {
    expect(segmentStartSec({ start_sec: 10, end_sec: 5 })).toBe(5);
  });
});

describe("resolveSegmentPlaybackStartSec", () => {
  const segment = { start_sec: 4, end_sec: 10 };

  it("plays from playhead when inside segment", () => {
    expect(resolveSegmentPlaybackStartSec(7, segment)).toBe(7);
  });

  it("plays from playhead when past segment end; snaps to start when before", () => {
    expect(resolveSegmentPlaybackStartSec(2, segment)).toBe(4);
    expect(resolveSegmentPlaybackStartSec(10, segment)).toBe(10);
  });
});

describe("parseMediaTimeInput", () => {
  it("parses m:ss and mm:ss", () => {
    expect(parseMediaTimeInput("1:05")).toBe(65);
    expect(parseMediaTimeInput("12:30")).toBe(750);
  });

  it("parses h:mm:ss", () => {
    expect(parseMediaTimeInput("1:02:03")).toBe(3723);
  });

  it("parses plain seconds", () => {
    expect(parseMediaTimeInput("90")).toBe(90);
  });

  it("clamps to duration", () => {
    expect(parseMediaTimeInput("9:99", 120)).toBe(120);
  });

  it("returns null for invalid", () => {
    expect(parseMediaTimeInput("")).toBeNull();
    expect(parseMediaTimeInput("abc")).toBeNull();
    expect(parseMediaTimeInput("1:2:3:4")).toBeNull();
  });
});
