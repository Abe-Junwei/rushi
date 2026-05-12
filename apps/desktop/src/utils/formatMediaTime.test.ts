import { describe, expect, it } from "vitest";
import { formatMediaTime } from "./formatMediaTime";

describe("formatMediaTime", () => {
  it("formats under one hour", () => {
    expect(formatMediaTime(0)).toBe("0:00");
    expect(formatMediaTime(5)).toBe("0:05");
    expect(formatMediaTime(65)).toBe("1:05");
  });

  it("formats with hours", () => {
    expect(formatMediaTime(3600)).toBe("1:00:00");
    expect(formatMediaTime(3661)).toBe("1:01:01");
  });
});
