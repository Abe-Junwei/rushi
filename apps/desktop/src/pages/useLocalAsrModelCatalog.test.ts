import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalAsrModelCatalog } from "./useLocalAsrModelCatalog";

const applyHubModelToSidecar = vi.fn<
  () => Promise<{ ok: boolean; message?: string; transcribeReady?: boolean; needsManualSidecarRestart?: boolean }>
>();

vi.mock("../services/shellCapabilities", () => ({
  readShellManagesBundledSidecarSync: () => false,
}));

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
  getLocalAsrHubModelPref: vi.fn(() => Promise.resolve("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch")),
  getLocalAsrRecognitionLanguagePref: vi.fn(() => Promise.resolve("zh")),
  asrAppManagesBundledSidecar: vi.fn(() => Promise.resolve(true)),
}));

const toastError = vi.fn();
vi.mock("../services/ui/toast", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: (...args: unknown[]) => {
      toastError(...args);
    },
    dismiss: vi.fn(),
  },
}));

describe("useLocalAsrModelCatalog applySelectedModel", () => {
  beforeEach(() => {
    applyHubModelToSidecar.mockReset();
    applyHubModelToSidecar.mockResolvedValue({ ok: true, transcribeReady: true, message: "ok" });
    toastError.mockReset();
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
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining("asr:dev"));
    });
    expect(applyHubModelToSidecar).toHaveBeenCalled();
  });
});
