import { beforeEach, describe, expect, it, vi } from "vitest";

const asrSupervisorSnapshot = vi.fn();
const tryStartBundledAsrSidecar = vi.fn();
const pollLoopbackHealthUntil = vi.fn();

vi.mock("../../tauri/asrSetupApi", () => ({
  asrSupervisorSnapshot: () => asrSupervisorSnapshot(),
}));

vi.mock("../../tauri/projectAsrMaintenanceApi", () => ({
  tryStartBundledAsrSidecar: () => tryStartBundledAsrSidecar(),
}));

vi.mock("./asrHealthSnapshot", () => ({
  pollLoopbackHealthUntil: (opts: unknown) => pollLoopbackHealthUntil(opts),
}));

describe("softWakeIdleSidecar", () => {
  beforeEach(() => {
    asrSupervisorSnapshot.mockReset();
    tryStartBundledAsrSidecar.mockReset();
    pollLoopbackHealthUntil.mockReset();
  });

  it("skips when not idle-stopped", async () => {
    const { softWakeIdleSidecar } = await import("./localAsrSidecarSoftWake");
    asrSupervisorSnapshot.mockResolvedValue({
      phase: "ready",
      executableSource: "bundled_media",
      lastErrorCode: null,
    });
    const result = await softWakeIdleSidecar();
    expect(result).toEqual({ status: "skipped", reason: "not_idle_sleep" });
    expect(tryStartBundledAsrSidecar).not.toHaveBeenCalled();
  });

  it("try_starts and polls when idle-stopped", async () => {
    const { softWakeIdleSidecar } = await import("./localAsrSidecarSoftWake");
    asrSupervisorSnapshot.mockResolvedValue({
      phase: "stopped",
      executableSource: "bundled_media",
      lastErrorCode: null,
    });
    tryStartBundledAsrSidecar.mockResolvedValue(undefined);
    pollLoopbackHealthUntil.mockResolvedValue({ funasr_ready: true });
    const result = await softWakeIdleSidecar();
    expect(tryStartBundledAsrSidecar).toHaveBeenCalled();
    expect(result).toEqual({ status: "woke", healthOk: true });
  });
});
