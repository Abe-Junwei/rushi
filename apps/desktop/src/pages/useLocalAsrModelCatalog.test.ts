import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalAsrModelCatalog } from "./useLocalAsrModelCatalog";

const applyHubModelToSidecar = vi.fn<
  () => Promise<{ ok: boolean; message?: string; needsManualSidecarRestart?: boolean }>
>();

vi.mock("../config/env", () => ({
  asrBaseUrl: () => "http://127.0.0.1:8741",
  asrHealthUrl: () => "http://127.0.0.1:8741/health",
  isDefaultBundledAsrTarget: () => true,
  isTauriRuntime: () => true,
}));

vi.mock("../services/asr/localAsrSetupModelStep", () => ({
  applyHubModelToSidecar: () => applyHubModelToSidecar(),
}));

vi.mock("../services/asr/loopbackFetch", () => ({
  loopbackFetch: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}));

vi.mock("../tauri/projectApi", () => ({
  getLocalAsrHubModelPref: vi.fn(() => Promise.resolve("iic/SenseVoiceSmall")),
}));

describe("useLocalAsrModelCatalog applySelectedModel", () => {
  beforeEach(() => {
    applyHubModelToSidecar.mockReset();
    applyHubModelToSidecar.mockResolvedValue({ ok: true });
  });

  it("delegates to applyHubModelToSidecar and surfaces failure message", async () => {
    applyHubModelToSidecar.mockResolvedValue({
      ok: false,
      needsManualSidecarRestart: true,
      message: "请执行 npm run asr:dev",
    });
    const refreshAsrRuntimeInfo = vi.fn(async () => {});
    const { result } = renderHook(() => useLocalAsrModelCatalog(refreshAsrRuntimeInfo));

    await act(async () => {
      await result.current.applySelectedModel();
    });

    await waitFor(() => {
      expect(result.current.applyMessage).toContain("asr:dev");
    });
    expect(applyHubModelToSidecar).toHaveBeenCalled();
  });
});
