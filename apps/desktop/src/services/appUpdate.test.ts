import { describe, expect, it, vi } from "vitest";
import {
  APP_UPDATE_BACKGROUND_CHECK_INTERVAL_MS,
  APP_UPDATE_OTA_BASELINE_VERSION,
  compareSemver,
  isAppUpdateSupportedForVersion,
  mapAppUpdateError,
  shouldRunBackgroundAppUpdateCheck,
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

describe("background update check cadence", () => {
  it("uses a 3-day interval", () => {
    expect(APP_UPDATE_BACKGROUND_CHECK_INTERVAL_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("skips background checks while dialog is open or downloading", () => {
    expect(
      shouldRunBackgroundAppUpdateCheck({ dialogOpen: false, downloadBusy: false }),
    ).toBe(true);
    expect(
      shouldRunBackgroundAppUpdateCheck({ dialogOpen: true, downloadBusy: false }),
    ).toBe(false);
    expect(
      shouldRunBackgroundAppUpdateCheck({ dialogOpen: false, downloadBusy: true }),
    ).toBe(false);
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
