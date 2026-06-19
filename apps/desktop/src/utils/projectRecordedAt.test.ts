import { describe, expect, it } from "vitest";
import { normalizeRecordedAtForSave } from "./projectRecordedAt";

describe("projectRecordedAt", () => {
  it("trims on save", () => {
    expect(normalizeRecordedAtForSave("  2024-03  ")).toBe("2024-03");
    expect(normalizeRecordedAtForSave("约 1990 年代")).toBe("约 1990 年代");
    expect(normalizeRecordedAtForSave(null)).toBe("");
  });
});
