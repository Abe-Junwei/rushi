import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AsrSetupOutcome } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import { initialSetupSteps } from "./asrSetupState";
import { useLocalRuntimeSetupSupport } from "./useLocalRuntimeSetupSupport";

const localRuntimeDiagnose = vi.fn<() => Promise<LocalRuntimeDiagnose>>();
const localRuntimeDownloadSidecar = vi.fn<() => Promise<{ started: boolean; reason?: string | null }>>();
const localRuntimeCancelDownload = vi.fn<() => Promise<boolean>>();
const localRuntimeRevalidateInstall = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
const localRuntimeClearInstall = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
const localRuntimeRestorePrevious = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();

vi.mock("../tauri/localRuntimeApi", () => ({
  localRuntimeDiagnose: () => localRuntimeDiagnose(),
  localRuntimeDownloadSidecar: () => localRuntimeDownloadSidecar(),
  localRuntimeCancelDownload: () => localRuntimeCancelDownload(),
  localRuntimeRevalidateInstall: () => localRuntimeRevalidateInstall(),
  localRuntimeClearInstall: () => localRuntimeClearInstall(),
  localRuntimeRestorePrevious: () => localRuntimeRestorePrevious(),
}));

function makeDiag(overrides: Partial<LocalRuntimeDiagnose> = {}): LocalRuntimeDiagnose {
  return {
    manifestConfigured: true,
    manifestStatus: "ok",
    availableVersion: "0.1.0",
    install: {
      phase: "idle",
      message: "",
      downloadedBytes: null,
      totalBytes: null,
      version: null,
      error: null,
    },
    installed: {
      status: "installed",
      version: "0.1.0",
      executablePath: "/tmp/local_runtime/asr-sidecar/0.1.0/rushi-asr-sidecar",
      rootDir: "/tmp/local_runtime/asr-sidecar",
      detail: null,
    },
    blockingIssue: null,
    ...overrides,
  };
}

function useHarness() {
  const [setupSteps, setSetupSteps] = useState(initialSetupSteps());
  const [setupMessage, setSetupMessage] = useState("");
  const [setupOutcome, setSetupOutcome] = useState<AsrSetupOutcome>("idle");
  const support = useLocalRuntimeSetupSupport({
    tauriRuntime: true,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  });
  return {
    ...support,
    setupSteps,
    setupMessage,
    setupOutcome,
  };
}

describe("useLocalRuntimeSetupSupport", () => {
  beforeEach(() => {
    localRuntimeDiagnose.mockReset();
    localRuntimeDownloadSidecar.mockReset();
    localRuntimeCancelDownload.mockReset();
    localRuntimeRevalidateInstall.mockReset();
    localRuntimeClearInstall.mockReset();
    localRuntimeRestorePrevious.mockReset();
  });

  it("reports success after revalidating an installed runtime", async () => {
    localRuntimeRevalidateInstall.mockResolvedValue({ ok: true });
    localRuntimeDiagnose.mockResolvedValue(makeDiag());

    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.revalidateLocalRuntime();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("idle");
    });
    expect(result.current.setupMessage).toContain("验证通过");
    expect(localRuntimeRevalidateInstall).toHaveBeenCalledTimes(1);
  });

  it("clears the installed runtime and reports fallback guidance", async () => {
    localRuntimeClearInstall.mockResolvedValue({ ok: true });
    localRuntimeDiagnose
      .mockResolvedValueOnce(makeDiag())
      .mockResolvedValueOnce(
        makeDiag({
          install: {
            phase: "idle",
            message: "",
            downloadedBytes: null,
            totalBytes: null,
            version: null,
            error: null,
          },
          installed: {
            status: "missing",
            version: null,
            executablePath: null,
            rootDir: "/tmp/local_runtime/asr-sidecar",
            detail: null,
          },
        }),
      );

    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.clearLocalRuntime();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("idle");
    });
    expect(result.current.setupMessage).toContain("已清除应用数据侧车");
    expect(localRuntimeClearInstall).toHaveBeenCalledTimes(1);
  });

  it("blocks revalidate when install metadata is corrupt", async () => {
    localRuntimeRevalidateInstall.mockResolvedValue({ ok: false, reason: "not_revalidatable" });

    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.revalidateLocalRuntime();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("blocked");
    });
    expect(result.current.setupMessage).toContain("安装元数据已损坏");
  });

  it("restores the previous runtime version when available", async () => {
    localRuntimeRestorePrevious.mockResolvedValue({ ok: true });
    localRuntimeDiagnose
      .mockResolvedValueOnce(
        makeDiag({
          installed: {
            status: "installed",
            version: "0.2.0",
            previousVersion: "0.1.0",
            executablePath: "/tmp/local_runtime/asr-sidecar/0.2.0/rushi-asr-sidecar",
            rootDir: "/tmp/local_runtime/asr-sidecar",
            detail: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeDiag({
          installed: {
            status: "installed",
            version: "0.1.0",
            previousVersion: "0.2.0",
            executablePath: "/tmp/local_runtime/asr-sidecar/0.1.0/rushi-asr-sidecar",
            rootDir: "/tmp/local_runtime/asr-sidecar",
            detail: null,
          },
        }),
      );

    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.restorePreviousLocalRuntime();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("idle");
    });
    expect(result.current.setupMessage).toContain("恢复上一版本");
    expect(localRuntimeRestorePrevious).toHaveBeenCalledTimes(1);
  });

  it("reports upgrade failure while keeping the current installed runtime", async () => {
    localRuntimeDownloadSidecar.mockResolvedValue({ started: true });
    localRuntimeDiagnose
      .mockResolvedValueOnce(
        makeDiag({
          availableVersion: "0.2.0",
          install: {
            phase: "downloading",
            message: "正在下载新版本…",
            downloadedBytes: 1,
            totalBytes: 2,
            version: "0.2.0",
            error: null,
          },
          installed: {
            status: "installed",
            version: "0.1.0",
            executablePath: "/tmp/local_runtime/asr-sidecar/0.1.0/rushi-asr-sidecar",
            rootDir: "/tmp/local_runtime/asr-sidecar",
            detail: null,
          },
        }),
      )
      .mockResolvedValueOnce(
        makeDiag({
          availableVersion: "0.2.0",
          install: {
            phase: "error",
            message: "本机语音识别组件安装失败。",
            downloadedBytes: null,
            totalBytes: null,
            version: "0.2.0",
            error: "local_runtime_verify_http_500",
          },
          installed: {
            status: "installed",
            version: "0.1.0",
            executablePath: "/tmp/local_runtime/asr-sidecar/0.1.0/rushi-asr-sidecar",
            rootDir: "/tmp/local_runtime/asr-sidecar",
            detail: null,
          },
          blockingIssue: "语音识别组件已下载，但健康验证未通过。可尝试重新验证、恢复上一版或导出诊断包。",
        }),
      );

    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.downloadLocalRuntime();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("error");
    });
    expect(result.current.setupMessage).toContain("健康验证未通过");
    expect(result.current.setupMessage).not.toContain("已安装完成");
    expect(localRuntimeDownloadSidecar).toHaveBeenCalledTimes(1);
  });
});
