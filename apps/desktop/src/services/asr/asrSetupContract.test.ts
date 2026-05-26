import { describe, expect, it } from "vitest";
import { formatDiskFree } from "./asrSetupContract";

describe("formatDiskFree", () => {
  it("formats gigabytes", () => {
    expect(formatDiskFree(2 * 1024 ** 3)).toBe("2.0 GB");
  });

  it("returns unknown for null", () => {
    expect(formatDiskFree(null)).toBe("未知");
  });
});
