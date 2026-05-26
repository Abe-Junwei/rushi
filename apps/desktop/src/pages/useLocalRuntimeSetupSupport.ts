import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupStep } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import * as localRuntimeApi from "../tauri/localRuntimeApi";
import { patchStep } from "./asrSetupState";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Params = {
  tauriRuntime: boolean;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export function useLocalRuntimeSetupSupport({
  tauriRuntime,
  setSetupSteps,
  setSetupMessage,
  setSetupOutcome,
}: Params) {
  const [localRuntimeDiag, setLocalRuntimeDiag] = useState<LocalRuntimeDiagnose | null>(null);

  const refreshLocalRuntimeDiagnose = useCallback(async (): Promise<LocalRuntimeDiagnose | null> => {
    if (!tauriRuntime) {
      setLocalRuntimeDiag(null);
      return null;
    }
    try {
      const diag = await localRuntimeApi.localRuntimeDiagnose();
      setLocalRuntimeDiag(diag);
      return diag;
    } catch {
      setLocalRuntimeDiag(null);
      return null;
    }
  }, [tauriRuntime]);

  const waitForLocalRuntimeInstall = useCallback(async (): Promise<LocalRuntimeDiagnose | null> => {
    for (let i = 0; i < 90; i++) {
      const diag = await refreshLocalRuntimeDiagnose();
      if (diag?.installed.status === "installed") {
        return diag;
      }
      if (diag?.install.phase === "error" || diag?.install.phase === "cancelled") {
        return diag;
      }
      await sleep(1000);
    }
    return refreshLocalRuntimeDiagnose();
  }, [refreshLocalRuntimeDiagnose]);

  const downloadLocalRuntime = useCallback(async () => {
    setSetupOutcome("running");
    setSetupMessage("");
    const started = await localRuntimeApi.localRuntimeDownloadSidecar();
    if (!started.started && started.reason !== "already_running") {
      throw new Error(started.reason ?? "local_runtime_download_failed");
    }
    await refreshLocalRuntimeDiagnose();
    const after = await waitForLocalRuntimeInstall();
    if (after?.installed.status === "installed") {
      setSetupMessage("本机语音识别组件已安装完成。");
      setSetupOutcome("idle");
      return;
    }
    setSetupMessage(after?.blockingIssue ?? "本机语音识别组件安装失败。");
    setSetupOutcome(after?.install.phase === "cancelled" ? "blocked" : "error");
  }, [refreshLocalRuntimeDiagnose, setSetupMessage, setSetupOutcome, waitForLocalRuntimeInstall]);

  const cancelLocalRuntime = useCallback(async () => {
    await localRuntimeApi.localRuntimeCancelDownload();
    await refreshLocalRuntimeDiagnose();
    setSetupMessage("已请求取消本机语音识别组件下载。");
    setSetupOutcome("blocked");
  }, [refreshLocalRuntimeDiagnose, setSetupMessage, setSetupOutcome]);

  const ensureLocalRuntimeInstalled = useCallback(
    async (reason: "missing" | "repair"): Promise<boolean> => {
      const diag = await refreshLocalRuntimeDiagnose();
      if (!diag?.manifestConfigured) {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "error",
            detail: "未配置应用内侧车下载源",
          }),
        );
        setSetupMessage(
          diag?.blockingIssue ??
            "当前没有可用内置侧车，且未配置应用内 local runtime manifest，无法自动修复。",
        );
        setSetupOutcome("blocked");
        return false;
      }
      if (diag.installed.status === "installed") {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "ok",
            detail: "已检测到应用数据中的侧车运行时",
          }),
        );
        return true;
      }
      setSetupSteps((steps) =>
        patchStep(steps, "sidecar", {
          status: "running",
          detail: reason === "repair" ? "正在下载修复侧车运行时…" : "正在下载本机语音识别组件…",
        }),
      );
      const started = await localRuntimeApi.localRuntimeDownloadSidecar();
      if (!started.started && started.reason !== "already_running") {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "error",
            detail: started.reason ?? "local_runtime_download_failed",
          }),
        );
        setSetupMessage(started.reason ?? "本机语音识别组件安装失败，请检查下载源后重试。");
        setSetupOutcome("error");
        return false;
      }
      const after = await waitForLocalRuntimeInstall();
      if (after?.installed.status === "installed") {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "ok",
            detail: "应用内侧车运行时已安装完成",
          }),
        );
        return true;
      }
      setSetupSteps((steps) =>
        patchStep(steps, "sidecar", {
          status: "error",
          detail: after?.blockingIssue ?? "本机语音识别组件安装失败",
        }),
      );
      setSetupMessage(after?.blockingIssue ?? "本机语音识别组件安装失败，请检查下载源后重试。");
      setSetupOutcome(after?.install.phase === "cancelled" ? "blocked" : "error");
      return false;
    },
    [
      refreshLocalRuntimeDiagnose,
      setSetupMessage,
      setSetupOutcome,
      setSetupSteps,
      waitForLocalRuntimeInstall,
    ],
  );

  return {
    localRuntimeDiag,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    ensureLocalRuntimeInstalled,
  };
}
