import { describe, expect, it } from "vitest";
import {
  formatSegmentTextWithAnnotation,
  formatSrt,
  formatSrtTime,
  formatTxt,
  type ExportSegment,
} from "./exportFormatters";

describe("formatSrtTime", () => {
  it("formats zero", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
  });

  it("formats with milliseconds", () => {
    expect(formatSrtTime(1.5)).toBe("00:00:01,500");
  });

  it("carries millisecond overflow into next second", () => {
    expect(formatSrtTime(1.9996)).toBe("00:00:02,000");
  });
});

describe("formatTxt / formatSrt", () => {
  const segs: ExportSegment[] = [
    { idx: 0, start_sec: 0, end_sec: 1, text: "甲" },
    { idx: 1, start_sec: 1, end_sec: 2.5, text: "乙" },
  ];

  it("joins txt lines", () => {
    expect(formatTxt(segs)).toBe("甲\n乙");
  });

  it("builds srt cues", () => {
    const s = formatSrt(segs);
    expect(s).toContain("1\n");
    expect(s).toContain("-->");
    expect(s).toContain("甲");
  });

  it("appends annotation in parentheses for txt", () => {
    const withNote: ExportSegment[] = [
      { idx: 0, start_sec: 0, end_sec: 1, text: "甲", annotation: "存疑" },
      { idx: 1, start_sec: 1, end_sec: 2, text: "乙" },
    ];
    expect(formatTxt(withNote)).toBe("甲（存疑）\n乙");
    expect(formatSegmentTextWithAnnotation("甲", "  ")).toBe("甲");
  });

  it("appends annotation in parentheses for srt cue body", () => {
    const withNote: ExportSegment[] = [
      { idx: 0, start_sec: 0, end_sec: 1, text: "甲", annotation: "待核对" },
    ];
    const s = formatSrt(withNote);
    expect(s).toContain("甲（待核对）");
  });

  it("exports annotation-only line for txt", () => {
    const withNote: ExportSegment[] = [
      { idx: 0, start_sec: 0, end_sec: 1, text: "", annotation: "仅备注" },
    ];
    expect(formatTxt(withNote)).toBe("（仅备注）");
  });
});
