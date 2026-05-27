import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupStep } from "../services/asr/asrSetupContract";
import { isLocalRuntimeManifestInstallBlocked, type LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import * as localRuntimeApi from "../tauri/localRuntimeApi";
import { patchStep } from "./asrSetupState";
import {
  describeLocalRuntimeActionError,
  missingRuntimeDiagnoseMessage,
} from "./localRuntimeSetupHelpers";

type Params = {
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  waitForLocalRuntimeInstall: () => Promise<LocalRuntimeDiagnose | null>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export function useLocalRuntimeEnsureInstalled({
  refreshLocalRuntimeDiagnose,
  waitForLocalRuntimeInstall,
  setSetupSteps,
  setSetupMessage,
  setSetupOutcome,
}: Params) {
  return useCallback(
    async (reason: "missing" | "repair"): Promise<boolean> => {
      const diag = await refreshLocalRuntimeDiagnose();
      if (!diag) {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "error",
            detail: "读取应用内侧车状态失败",
          }),
        );
        setSetupMessage(missingRuntimeDiagnoseMessage());
        setSetupOutcome("error");
        return false;
      }
      if (isLocalRuntimeManifestInstallBlocked(diag)) {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "error",
            detail: diag.manifestIssue ?? "应用内侧车下载源当前不可用",
          }),
        );
        setSetupMessage(
          diag.manifestIssue ??
            diag.blockingIssue ??
            "当前应用内侧车 manifest 暂不可用，无法自动下载或修复组件。",
        );
        setSetupOutcome("blocked");
        return false;
      }
      if (!diag.manifestConfigured) {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "error",
            detail: "未配置应用内侧车下载源",
          }),
        );
        setSetupMessage(
          diag.blockingIssue ??
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
      let started;
      try {
        started = await localRuntimeApi.localRuntimeDownloadSidecar();
      } catch (error) {
        setSetupSteps((steps) =>
          patchStep(steps, "sidecar", {
            status: "error",
            detail: "下载命令调用失败",
          }),
        );
        setSetupMessage(describeLocalRuntimeActionError("下载语音识别组件", error));
        setSetupOutcome("error");
        return false;
      }
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
}
