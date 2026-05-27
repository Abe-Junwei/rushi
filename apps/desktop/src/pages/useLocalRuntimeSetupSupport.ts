import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupStep } from "../services/asr/asrSetupContract";
import { useLocalRuntimeDiagnoseState } from "./useLocalRuntimeDiagnoseState";
import { useLocalRuntimeEnsureInstalled } from "./useLocalRuntimeEnsureInstalled";
import { useLocalRuntimeInstallActions } from "./useLocalRuntimeInstallActions";

type Params = {
  tauriRuntime: boolean;
  refreshEnvironmentDiagnostics?: () => Promise<void>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export function useLocalRuntimeSetupSupport({
  tauriRuntime,
  refreshEnvironmentDiagnostics,
  setSetupSteps,
  setSetupMessage,
  setSetupOutcome,
}: Params) {
  const syncEnvironmentDiagnostics = useCallback(async () => {
    await refreshEnvironmentDiagnostics?.();
  }, [refreshEnvironmentDiagnostics]);

  const { localRuntimeDiag, refreshLocalRuntimeDiagnose, waitForLocalRuntimeInstall } =
    useLocalRuntimeDiagnoseState(tauriRuntime);

  const {
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
  } = useLocalRuntimeInstallActions({
    refreshLocalRuntimeDiagnose,
    waitForLocalRuntimeInstall,
    syncEnvironmentDiagnostics,
    setSetupMessage,
    setSetupOutcome,
  });

  const ensureLocalRuntimeInstalled = useLocalRuntimeEnsureInstalled({
    refreshLocalRuntimeDiagnose,
    waitForLocalRuntimeInstall,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  });

  return {
    localRuntimeDiag,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
    ensureLocalRuntimeInstalled,
  };
}
