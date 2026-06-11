import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupStep } from "../services/asr/asrSetupContract";
import { fetchAsrHealthCaps } from "../services/asr/asrHealthSnapshot";
import {
  snapshotSelectedModelPrepare,
  type LocalAsrSetupSelectionContext,
} from "../services/asr/localAsrSetupModelStep";
import { patchStep } from "./asrSetupState";

const HEALTH_POLL_MS = 1000;
const HEALTH_POLL_MAX = 45;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHealthSnapshot() {
  return fetchAsrHealthCaps();
}

type Params = {
  deps: {
    refreshAsrHealth: (options?: { touchUi?: boolean }) => Promise<void>;
    refreshAsrRuntimeInfo: () => Promise<void>;
    prepareDefaultFunasrModel: (options?: import("./usePrepareModelController").PrepareDefaultModelOptions) => Promise<void>;
    getSetupSelection: () => LocalAsrSetupSelectionContext;
  };
  refreshSetupDiagnose?: (options?: {
    resetSteps?: boolean;
    touchUi?: boolean;
  }) => Promise<unknown>;
  markPortConflictAcknowledged: () => void;
  setSetupBusy: Dispatch<SetStateAction<boolean>>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export function useAsrSetupHealthFlow({
  deps,
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
        await deps.refreshAsrHealth({ touchUi: false });
        return true;
      }
      await sleep(HEALTH_POLL_MS);
    }
    await deps.refreshAsrHealth({ touchUi: false });
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
      const selection = deps.getSetupSelection();
      const modelSnap = await snapshotSelectedModelPrepare(selection);
      if (modelSnap.ready && modelSnap.sidecarMatchesSelection) {
        markPortConflictAcknowledged();
        setSetupSteps((steps) => {
          let next = patchStep(steps, "model", {
            status: "skipped",
            detail: `${modelSnap.modelLabel} 与辅助模型已在缓存中`,
          });
          next = patchStep(next, "done", { status: "ok", detail: "当前 8741 服务已可用于转写" });
          return next;
        });
        setSetupMessage("当前 8741 服务已就绪，无需重复准备。");
        setSetupOutcome("ready");
        await deps.refreshAsrRuntimeInfo();
        return;
      }
      if (!modelSnap.sidecarMatchesSelection) {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "error",
            detail: `侧车未加载 ${modelSnap.modelLabel}`,
          }),
        );
        setSetupMessage(
          `8741 上的服务未加载所选模型（${modelSnap.modelLabel}）。请先在环境页应用所选模型，或改用内置侧车。`,
        );
        setSetupOutcome("blocked");
        return;
      }
      if (!modelSnap.ready) {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "running",
            detail: `正在补齐 ${modelSnap.modelLabel} 与辅助模型…`,
          }),
        );
        await deps.prepareDefaultFunasrModel();
      } else {
        setSetupSteps((steps) =>
          patchStep(steps, "model", {
            status: "skipped",
            detail: `${modelSnap.modelLabel} 与辅助模型已在缓存中`,
          }),
        );
      }

      await deps.refreshAsrRuntimeInfo();
      const afterCaps = await fetchHealthSnapshot();
      const afterSnap = await snapshotSelectedModelPrepare(selection);
      const transcribeReady =
        afterSnap.ready &&
        afterSnap.sidecarMatchesSelection &&
        afterCaps?.ready_for_transcribe === true &&
        afterCaps.funasr_model_id === selection.selectedHubModelId;
      if (transcribeReady) {
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
