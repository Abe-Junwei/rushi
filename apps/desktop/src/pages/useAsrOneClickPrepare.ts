import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupStep } from "../services/asr/asrSetupContract";
import { runAsrOneClickPrepareFlow, type AsrOneClickPrepareDeps } from "../services/asr/asrOneClickPrepareFlow";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import type { AsrSetupReport } from "../services/asr/asrSetupContract";

export function useAsrOneClickPrepare(args: {
  tauriRuntime: boolean;
  deps: AsrOneClickPrepareDeps;
  refreshSetupDiagnose: (options?: {
    resetSteps?: boolean;
    touchUi?: boolean;
  }) => Promise<AsrSetupReport | null>;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  ensureLocalRuntimeInstalled: (reason: "missing" | "repair") => Promise<boolean>;
  pollUntilHealth: () => Promise<boolean>;
  setSetupBusy: Dispatch<SetStateAction<boolean>>;
  setPortConflictAcknowledged: Dispatch<SetStateAction<boolean>>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
}) {
  const {
    tauriRuntime,
    deps,
    refreshSetupDiagnose,
    refreshLocalRuntimeDiagnose,
    ensureLocalRuntimeInstalled,
    pollUntilHealth,
    setSetupBusy,
    setPortConflictAcknowledged,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  } = args;

  const runOneClickAsrPrepare = useCallback(async () => {
    if (!tauriRuntime) {
      setSetupMessage("一键准备需要在 Tauri 桌面壳中运行。");
      setSetupOutcome("error");
      return;
    }

    setSetupBusy(true);
    setPortConflictAcknowledged(false);
    setSetupOutcome("running");
    setSetupMessage("");
    try {
      await runAsrOneClickPrepareFlow(deps, {
        refreshSetupDiagnose,
        refreshLocalRuntimeDiagnose,
        ensureLocalRuntimeInstalled,
        pollUntilHealth,
        setSetupSteps,
        setSetupMessage,
        setSetupOutcome,
      });
    } finally {
      setSetupBusy(false);
    }
  }, [
    deps,
    ensureLocalRuntimeInstalled,
    pollUntilHealth,
    refreshLocalRuntimeDiagnose,
    refreshSetupDiagnose,
    setPortConflictAcknowledged,
    setSetupBusy,
    setSetupMessage,
    setSetupOutcome,
    setSetupSteps,
    tauriRuntime,
  ]);

  return { runOneClickAsrPrepare };
}
