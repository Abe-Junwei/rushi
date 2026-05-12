import { describe, expect, it } from "vitest";
import { asrHealthUrl, asrBaseUrl, isDefaultBundledAsrTarget } from "./env";

describe("asrHealthUrl", () => {
  it("strips trailing slash from base", () => {
    expect(asrHealthUrl("http://127.0.0.1:8741/")).toBe("http://127.0.0.1:8741/health");
  });

  it("appends health path", () => {
    expect(asrHealthUrl("http://127.0.0.1:8741")).toBe("http://127.0.0.1:8741/health");
  });
});

describe("isDefaultBundledAsrTarget", () => {
  it("matches default base URL when VITE override absent", () => {
    expect(asrBaseUrl()).toMatch(/8741$/);
    expect(isDefaultBundledAsrTarget()).toBe(true);
  });
});
