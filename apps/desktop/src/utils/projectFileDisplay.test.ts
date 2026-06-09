import { describe, expect, it } from "vitest";
import { formatProjectHubMetadataLine } from "./projectFileDisplay";

describe("formatProjectHubMetadataLine", () => {
  it("joins time, subject, and narrator with middle dots", () => {
    expect(
      formatProjectHubMetadataLine({
        recorded_at: "2024-03",
        subject: "家族口述",
        narrator: "张三",
      }),
    ).toBe("2024-03 · 家族口述 · 张三");
  });

  it("omits empty fields", () => {
    expect(
      formatProjectHubMetadataLine({
        recorded_at: "  ",
        subject: "主题",
        narrator: null,
      }),
    ).toBe("主题");
  });

  it("returns null when nothing is filled", () => {
    expect(formatProjectHubMetadataLine({})).toBeNull();
  });
});
