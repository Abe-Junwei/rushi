import { describe, expect, it } from "vitest";
import {
  detectRecordedAtMode,
  normalizeRecordedAtForSave,
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

  it("trims on save", () => {
    expect(normalizeRecordedAtForSave("  2024-03  ")).toBe("2024-03");
  });
});
