import { describe, expect, it } from "vitest";
import {
  detectRecordedAtMode,
  formatRecordedAtDate,
  formatRecordedAtMonth,
  normalizeRecordedAtForSave,
  parseRecordedAtDateParts,
  parseRecordedAtMonthParts,
  recordedAtValueForMode,
} from "./projectRecordedAt";

describe("projectRecordedAt", () => {
  it("detects month, date, and free-text modes", () => {
    expect(detectRecordedAtMode("2024-03")).toBe("month");
    expect(detectRecordedAtMode("2024-03-15")).toBe("date");
    expect(detectRecordedAtMode("约 1990 年代")).toBe("text");
  });

  it("converts values when switching modes", () => {
    expect(recordedAtValueForMode("2024-03-15", "month")).toBe("2024-03");
    expect(recordedAtValueForMode("2024-03", "date")).toBe("2024-03-01");
    expect(recordedAtValueForMode("约 1990 年代", "text")).toBe("约 1990 年代");
  });

  it("parses and formats month parts for split inputs", () => {
    expect(parseRecordedAtMonthParts("2024-06")).toEqual({ year: "2024", month: "06" });
    expect(parseRecordedAtMonthParts("2024")).toEqual({ year: "2024", month: "" });
    expect(formatRecordedAtMonth("2024", "06")).toBe("2024-06");
    expect(formatRecordedAtMonth("2024", "")).toBe("2024");
    expect(formatRecordedAtMonth("202", "")).toBe("202");
  });

  it("parses and formats date parts for split inputs", () => {
    expect(parseRecordedAtDateParts("2024-06-15")).toEqual({
      year: "2024",
      month: "06",
      day: "15",
    });
    expect(formatRecordedAtDate("2024", "06", "15")).toBe("2024-06-15");
  });

  it("trims on save", () => {
    expect(normalizeRecordedAtForSave("  2024-03  ")).toBe("2024-03");
  });
});
