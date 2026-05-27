import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupStep } from "../services/asr/asrSetupContract";
import { asrHealthUrl } from "../config/env";
import { patchStep } from "./asrSetupState";
import { parseAsrHealthJson } from "./useAsrBridgeController";

const HEALTH_POLL_MS = 1000;
const HEALTH_POLL_MAX = 45;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHealthSnapshot(): Promise<ReturnType<typeof parseAsrHealthJson>> {
  const url = asrHealthUrl();
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data: unknown = await res.json().catch(() => null);
    return parseAsrHealthJson(data);
  } catch {
    return null;
  }
}

type Params = {
  deps: {
    refreshAsrHealth: () => Promise<void>;
    refreshAsrRuntimeInfo: () => Promise<void>;
    prepareDefaultFunasrModel: () => Promise<void>;
  };
  refreshSetupDiagnose: () => Promise<unknown>;
  markPortConflictAcknowledged: () => void;
  setSetupBusy: Dispatch<SetStateAction<boolean>>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export function useAsrSetupHealthFlow({
  deps,
  refreshSetupDiagnose,
  markPortConflictAcknowledged,
  setSetupBusy,
  setSetupSteps,
  setSetupMessage,
  setSetupOutcome,
}: Params) {
  const pollUntilHealth = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < HEALTH_POLL_MAX; i++) {
      const caps = await fetchHealthSnapshot();
      if (caps?.funasr_ready) {
        await deps.refreshAsrHealth();
        return true;
      }
      if (caps?.ffmpeg_ok) {
        await deps.refreshAsrHealth();
      }
      await sleep(HEALTH_POLL_MS);
    }
    await deps.refreshAsrHealth();
    const last = await fetchHealthSnapshot();
    return last?.funasr_ready === true;
  }, [deps]);

  const acceptForeignPortService = useCallback(async () => {
    setSetupBusy(true);
    setSetupOutcome("running");
    setSetupMessage("");
    try {
      setSetupSteps((steps) =>
        patchStep(steps, "sidecar", { status: "skipped", detail: "使用当前 8741 服务" }),
      );
      setSetupSteps((steps) =>
        patchStep(steps, "health", { status: "running", detail: "检测当前 8741 服务…" }),
      );
      const caps = await fetchHealthSnapshot();
      await deps.refreshAsrHealth();
      if (!caps) {
        setSetupSteps((steps) =>
          patchStep(steps, "health", { status: "error", detail: "当前服务不是 rushi-asr" }),
        );
        setSetupMessage("8741 上的服务无法按 rushi-asr 解析，无法继续使用。");
        setSetupOutcome("error");
        return;
      }
      if (!caps.funasr_ready) {
        setSetupSteps((steps) =>
          patchStep(steps, "health", {
            status: "error",
            detail: "当前服务未加载 FunASR 运行时",
          }),
        );
        setSetupMessage("8741 上的当前服务可达，但 FunASR 运行时尚未就绪，无法继续使用。");
        setSetupOutcome("blocked");
        return;
      }

      setSetupSteps((steps) =>
        patchStep(steps, "health", { status: "ok", detail: "已连接当前 ASR 运行时" }),
      );
      if (!caps.funasr_required_models_cached) {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "running",
            detail: "正在补齐默认模型与辅助模型…",
          }),
        );
        await deps.prepareDefaultFunasrModel();
      } else {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "skipped",
            detail: "默认模型与辅助模型已在缓存中",
          }),
        );
      }

      await deps.refreshAsrRuntimeInfo();
      const latest = (await refreshSetupDiagnose()) as { readyForTranscribe?: boolean } | null;
      if (latest?.readyForTranscribe) {
        markPortConflictAcknowledged();
        setSetupSteps((steps) =>
          patchStep(steps, "done", { status: "ok", detail: "当前 8741 服务已可用于转写" }),
        );
        setSetupMessage("已使用当前 8741 服务，可直接开始转写。");
        setSetupOutcome("ready");
      } else {
        markPortConflictAcknowledged();
        setSetupMessage("已使用当前 8741 服务，但模型尚未完全准备好，请继续完成模型下载。");
        setSetupOutcome("blocked");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setSetupMessage(`使用当前 8741 服务失败：${msg}`);
      setSetupOutcome("error");
    } finally {
      setSetupBusy(false);
      await deps.refreshAsrRuntimeInfo();
    }
  }, [
    deps,
    markPortConflictAcknowledged,
    refreshSetupDiagnose,
    setSetupBusy,
    setSetupMessage,
    setSetupOutcome,
    setSetupSteps,
  ]);

  return {
    pollUntilHealth,
    acceptForeignPortService,
  };
}
