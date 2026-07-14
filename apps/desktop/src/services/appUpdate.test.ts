import { describe, expect, it, vi } from "vitest";
import {
  APP_UPDATE_OTA_BASELINE_VERSION,
  compareSemver,
  isAppUpdateSupportedForVersion,
  mapAppUpdateError,
} from "./appUpdate";

describe("appUpdate semver", () => {
  it("compareSemver orders patch releases", () => {
    expect(compareSemver("0.1.2", "0.1.1")).toBeGreaterThan(0);
    expect(compareSemver("0.1.1", "0.1.2")).toBeLessThan(0);
    expect(compareSemver("v0.1.2", "0.1.2")).toBe(0);
  });

  it("isAppUpdateSupportedForVersion gates OTA baseline", () => {
    expect(APP_UPDATE_OTA_BASELINE_VERSION).toBe("0.1.2");
    expect(isAppUpdateSupportedForVersion("0.1.1")).toBe(false);
    expect(isAppUpdateSupportedForVersion("0.1.2")).toBe(true);
    expect(isAppUpdateSupportedForVersion("0.2.0")).toBe(true);
  });
});

describe("mapAppUpdateError", () => {
  it("maps signature failures to Chinese guidance", () => {
    expect(mapAppUpdateError(new Error("invalid signature"))).toMatch(/验签失败/);
  });

  it("maps network failures", () => {
    expect(mapAppUpdateError(new Error("network timeout"))).toMatch(/无法连接/);
    expect(mapAppUpdateError(new Error("network timeout"))).toMatch(/updates\.rushi\.app/);
  });

  it("falls back to message text", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(mapAppUpdateError("custom")).toBe("custom");
    spy.mockRestore();
  });
});
