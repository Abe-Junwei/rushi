import { describe, expect, it } from "vitest";
import { isLocalRuntimeInstallRunning } from "./localRuntimeContract";

describe("isLocalRuntimeInstallRunning", () => {
  it("treats verifying as an active install phase", () => {
    expect(isLocalRuntimeInstallRunning("downloading")).toBe(true);
    expect(isLocalRuntimeInstallRunning("installing")).toBe(true);
    expect(isLocalRuntimeInstallRunning("verifying")).toBe(true);
  });

  it("returns false for non-running phases", () => {
    expect(isLocalRuntimeInstallRunning("idle")).toBe(false);
    expect(isLocalRuntimeInstallRunning("installed")).toBe(false);
    expect(isLocalRuntimeInstallRunning("error")).toBe(false);
    expect(isLocalRuntimeInstallRunning(null)).toBe(false);
  });
});
