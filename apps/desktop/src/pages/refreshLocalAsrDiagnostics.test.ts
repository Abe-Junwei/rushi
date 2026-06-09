import { describe, expect, it, vi } from "vitest";
import { refreshLocalAsrDiagnostics } from "./refreshLocalAsrDiagnostics";

describe("refreshLocalAsrDiagnostics", () => {
  it("refreshes health, cache, and setup diagnose without resetting steps", async () => {
    const refreshAsrHealth = vi.fn(async () => {});
    const refreshAsrModelCacheInfo = vi.fn(async () => {});
    const refreshSetupDiagnose = vi.fn(() => Promise.resolve(null));

    await refreshLocalAsrDiagnostics({
      refreshAsrHealth,
      refreshAsrModelCacheInfo,
      refreshSetupDiagnose,
    });

    expect(refreshAsrHealth).toHaveBeenCalledTimes(1);
    expect(refreshAsrHealth).toHaveBeenCalledWith({ touchUi: false });
    expect(refreshAsrModelCacheInfo).toHaveBeenCalledTimes(1);
    expect(refreshSetupDiagnose).toHaveBeenCalledWith({ resetSteps: false, touchUi: false });
  });

  it("allows setup diagnose option overrides", async () => {
    const refreshAsrHealth = vi.fn(async () => {});
    const refreshSetupDiagnose = vi.fn(() => Promise.resolve(null));

    await refreshLocalAsrDiagnostics(
      { refreshAsrHealth, refreshSetupDiagnose },
      { setupDiagnose: { resetSteps: false, touchUi: true } },
    );

    expect(refreshSetupDiagnose).toHaveBeenCalledWith({ resetSteps: false, touchUi: true });
  });
});
