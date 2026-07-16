import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import * as localRuntimeApi from "../tauri/localRuntimeApi";
import {
  describeLocalRuntimeActionError,
  retainedCurrentVersionMessage,
} from "./localRuntimeSetupHelpers";

type Params = {
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  waitForLocalRuntimeInstall: () => Promise<LocalRuntimeDiagnose | null>;
  syncEnvironmentDiagnostics: () => Promise<void>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export function useLocalRuntimeInstallActions({
  refreshLocalRuntimeDiagnose,
  waitForLocalRuntimeInstall,
  syncEnvironmentDiagnostics,
  setSetupMessage,
  setSetupOutcome,
}: Params) {
  const downloadLocalRuntime = useCallback(async () => {
    try {
      setSetupOutcome("running");
      setSetupMessage("");
      const started = await localRuntimeApi.localRuntimeDownloadSidecar();
      if (!started.started && started.reason === "cuda_download_running") {
        setSetupMessage("GPU 加速组件正在下载，请稍后再下载 / 修复语音识别组件。");
        setSetupOutcome("blocked");
        return;
      }
      if (!started.started && started.reason !== "already_running") {
        throw new Error(started.reason ?? "local_runtime_download_failed");
      }
      await refreshLocalRuntimeDiagnose();
      const after = await waitForLocalRuntimeInstall();
      const retainedCurrentMessage = retainedCurrentVersionMessage(after);
      if (retainedCurrentMessage) {
        setSetupMessage(after?.blockingIssue ?? retainedCurrentMessage);
        setSetupOutcome("error");
        return;
      }
      if (after?.installed.status === "installed") {
        setSetupMessage("本机语音识别组件已安装完成。");
        setSetupOutcome("idle");
        return;
      }
      setSetupMessage(after?.blockingIssue ?? "本机语音识别组件安装失败。");
      setSetupOutcome(after?.install.phase === "cancelled" ? "blocked" : "error");
    } catch (error) {
      setSetupMessage(describeLocalRuntimeActionError("下载 / 修复语音识别组件", error));
      setSetupOutcome("error");
    } finally {
      await syncEnvironmentDiagnostics();
    }
  }, [
    refreshLocalRuntimeDiagnose,
    setSetupMessage,
    setSetupOutcome,
    syncEnvironmentDiagnostics,
    waitForLocalRuntimeInstall,
  ]);

  const cancelLocalRuntime = useCallback(async () => {
    try {
      const cancelled = await localRuntimeApi.localRuntimeCancelDownload();
      await refreshLocalRuntimeDiagnose();
      setSetupMessage(cancelled ? "已请求取消本机语音识别组件下载。" : "当前没有正在进行的组件下载或验证任务。");
      setSetupOutcome("blocked");
    } catch (error) {
      setSetupMessage(describeLocalRuntimeActionError("取消语音识别组件下载", error));
      setSetupOutcome("error");
    } finally {
      await syncEnvironmentDiagnostics();
    }
  }, [refreshLocalRuntimeDiagnose, setSetupMessage, setSetupOutcome, syncEnvironmentDiagnostics]);

  const revalidateLocalRuntime = useCallback(async () => {
    try {
      setSetupOutcome("running");
      setSetupMessage("");
      const result = await localRuntimeApi.localRuntimeRevalidateInstall();
      if (!result.ok && result.reason !== "already_running") {
        setSetupMessage(
          result.reason === "not_installed"
            ? "当前没有可验证的应用数据侧车。请先下载安装语音识别组件。"
            : result.reason === "not_revalidatable"
              ? "当前安装元数据已损坏，无法直接重新验证。请先清除已安装组件后重新下载。"
              : result.reason ?? "本机语音识别组件验证失败。",
        );
        setSetupOutcome("blocked");
        return;
      }
      await refreshLocalRuntimeDiagnose();
      const after = await waitForLocalRuntimeInstall();
      if (after?.installed.status === "installed") {
        setSetupMessage("本机语音识别组件验证通过。");
        setSetupOutcome("idle");
        return;
      }
      setSetupMessage(after?.blockingIssue ?? "本机语音识别组件验证失败。");
      setSetupOutcome("error");
    } catch (error) {
      setSetupMessage(describeLocalRuntimeActionError("重新验证语音识别组件", error));
      setSetupOutcome("error");
    } finally {
      await syncEnvironmentDiagnostics();
    }
  }, [
    refreshLocalRuntimeDiagnose,
    setSetupMessage,
    setSetupOutcome,
    syncEnvironmentDiagnostics,
    waitForLocalRuntimeInstall,
  ]);

  const clearLocalRuntime = useCallback(async () => {
    try {
      setSetupMessage("");
      const result = await localRuntimeApi.localRuntimeClearInstall();
      if (!result.ok) {
        setSetupMessage(
          result.reason === "not_installed"
            ? "当前没有可清除的应用数据侧车。"
            : result.reason === "already_running"
              ? "组件正在下载或验证中，暂时不能清除。"
              : result.reason ?? "清除语音识别组件失败。",
        );
        setSetupOutcome("blocked");
        await refreshLocalRuntimeDiagnose();
        return;
      }
      await refreshLocalRuntimeDiagnose();
      setSetupMessage("已清除应用数据侧车，下次可重新下载安装或回退内置侧车。");
      setSetupOutcome("idle");
    } catch (error) {
      setSetupMessage(describeLocalRuntimeActionError("清除语音识别组件", error));
      setSetupOutcome("error");
    } finally {
      await syncEnvironmentDiagnostics();
    }
  }, [refreshLocalRuntimeDiagnose, setSetupMessage, setSetupOutcome, syncEnvironmentDiagnostics]);

  const restorePreviousLocalRuntime = useCallback(async () => {
    try {
      setSetupOutcome("running");
      setSetupMessage("");
      const result = await localRuntimeApi.localRuntimeRestorePrevious();
      if (!result.ok && result.reason !== "already_running") {
        setSetupMessage(
          result.reason === "no_previous"
            ? "当前没有可恢复的上一版本侧车。"
            : result.reason ?? "恢复上一版本的语音识别组件失败。",
        );
        setSetupOutcome("blocked");
        await refreshLocalRuntimeDiagnose();
        return;
      }
      await refreshLocalRuntimeDiagnose();
      const after = await waitForLocalRuntimeInstall();
      if (after?.installed.status === "installed") {
        setSetupMessage("已恢复上一版本的本机语音识别组件。");
        setSetupOutcome("idle");
        return;
      }
      setSetupMessage(after?.blockingIssue ?? "恢复上一版本的本机语音识别组件失败。");
      setSetupOutcome("error");
    } catch (error) {
      setSetupMessage(describeLocalRuntimeActionError("恢复上一版本语音识别组件", error));
      setSetupOutcome("error");
    } finally {
      await syncEnvironmentDiagnostics();
    }
  }, [
    refreshLocalRuntimeDiagnose,
    setSetupMessage,
    setSetupOutcome,
    syncEnvironmentDiagnostics,
    waitForLocalRuntimeInstall,
  ]);

  return {
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
  };
}
