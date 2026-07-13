import { describe, expect, it } from "vitest";
import { normalizeRecordedAtForSave, normalizeRecordedAtInput } from "./projectRecordedAt";

describe("projectRecordedAt", () => {
  it("normalizes common separators and Chinese date forms", () => {
    expect(normalizeRecordedAtInput("2024/3/15")).toBe("2024-03-15");
    expect(normalizeRecordedAtInput("2024.3.5")).toBe("2024-03-05");
    expect(normalizeRecordedAtInput("2024-3")).toBe("2024-03");
    expect(normalizeRecordedAtInput("2024年3月15日")).toBe("2024-03-15");
    expect(normalizeRecordedAtInput("2024年3月")).toBe("2024-03");
    expect(normalizeRecordedAtInput("2024年")).toBe("2024");
    expect(normalizeRecordedAtInput("  2024-03-15  ")).toBe("2024-03-15");
  });

  it("keeps approximate descriptions without forcing ISO", () => {
    expect(normalizeRecordedAtInput("约 1990 年代")).toBe("约 1990 年代");
    expect(normalizeRecordedAtInput("大概 1990 年前后")).toBe("大概 1990 年前后");
    expect(normalizeRecordedAtInput("2024 年春")).toBe("2024 年春");
  });

  it("save path uses the same normalizer", () => {
    expect(normalizeRecordedAtForSave("2024/3/15")).toBe("2024-03-15");
    expect(normalizeRecordedAtForSave(null)).toBe("");
  });

  it("rejects impossible calendar dates by leaving raw trimmed text", () => {
    expect(normalizeRecordedAtInput("2024-02-31")).toBe("2024-02-31");
  });
});
