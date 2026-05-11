import { describe, expect, it } from "vitest";
import { asrHealthUrl } from "./env";

describe("asrHealthUrl", () => {
  it("strips trailing slash from base", () => {
    expect(asrHealthUrl("http://127.0.0.1:8741/")).toBe("http://127.0.0.1:8741/health");
  });

  it("appends health path", () => {
    expect(asrHealthUrl("http://127.0.0.1:8741")).toBe("http://127.0.0.1:8741/health");
  });
});
