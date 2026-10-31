import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectAsrBridgeStack } from "./useProjectAsrBridgeStack";
import { softWakeIdleSidecar } from "../services/asr/localAsrSidecarSoftWake";
import { toast } from "../services/ui/toast";

const refresh = vi.hoisted(() => vi.fn<() => Promise<void>>());
const hasSnapshot = vi.hoisted(() => vi.fn(() => true));
vi.mock("../services/environmentCapabilityCoordinator", () => ({
  getEnvironmentCapabilityBlockReason: () => null,
  hasEnvironmentCapabilitySnapshot: () => hasSnapshot(),
}));
vi.mock("./useAsrBridgeController", () => ({
  useAsrBridgeController: () => ({
    refreshAsrHealth: refresh,
    refreshAsrRuntimeInfo: refresh,
    localAsrModelCatalog: { selectedHubModelId: "audit/model", catalogStatus: null },
    asrHealth: "error",
    asrCaps: null,
    asrPresentation: { blockReason: "not ready" },
  }),
}));
vi.mock("./useAsrSetupController", () => ({
  useAsrSetupController: () => ({ refreshSetupDiagnose: refresh, localRuntimeDiag: null }),
}));
vi.mock("../services/asr/localAsrSidecarSoftWake", () => ({ softWakeIdleSidecar: vi.fn() }));
vi.mock("../services/ui/toast", () => ({ toast: { warning: vi.fn() } }));

describe("Phase B soft-wake audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue();
    hasSnapshot.mockReturnValue(true);
  });

  it.each([
    [{ status: "failed", message: "launch failed" } as const, "恢复侧车失败：launch failed"],
    [{ status: "woke", healthOk: false } as const, "侧车已拉起，但仍未通过健康检查。"],
  ])("surfaces %j and refreshes runtime state", async (wake, message) => {
    vi.mocked(softWakeIdleSidecar).mockResolvedValue(wake);
    const { result } = renderHook(() => useProjectAsrBridgeStack());
    await act(() => result.current.softWakeBeforeLocalTranscribe());
    expect(toast.warning).toHaveBeenCalledWith(message);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("AUD-04 trusts the refreshed ready coordinator over a stale React block", () => {
    const { result } = renderHook(() => useProjectAsrBridgeStack());
    expect(result.current.localTranscribePreflight()).toBeNull();
  });

  it("falls back to presentation blockReason when coordinator has no snapshot", () => {
    hasSnapshot.mockReturnValue(false);
    const { result } = renderHook(() => useProjectAsrBridgeStack());
    expect(result.current.localTranscribePreflight()).toBe("not ready");
  });
});
