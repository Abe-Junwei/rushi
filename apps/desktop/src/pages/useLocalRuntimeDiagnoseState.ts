import { useCallback, useEffect, useState } from "react";
import { isLocalRuntimeInstallRunning, type LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import * as localRuntimeApi from "../tauri/localRuntimeApi";
import { sleep } from "./localRuntimeSetupHelpers";

export function useLocalRuntimeDiagnoseState(tauriRuntime: boolean) {
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

  const installPhase = localRuntimeDiag?.install.phase;

  useEffect(() => {
    if (!tauriRuntime || !isLocalRuntimeInstallRunning(installPhase)) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshLocalRuntimeDiagnose();
    }, 500);
    return () => window.clearInterval(timer);
  }, [installPhase, refreshLocalRuntimeDiagnose, tauriRuntime]);

  const waitForLocalRuntimeInstall = useCallback(async (): Promise<LocalRuntimeDiagnose | null> => {
    for (let i = 0; i < 90; i++) {
      const diag = await refreshLocalRuntimeDiagnose();
      if (!isLocalRuntimeInstallRunning(diag?.install.phase)) {
        return diag;
      }
      await sleep(1000);
    }
    return refreshLocalRuntimeDiagnose();
  }, [refreshLocalRuntimeDiagnose]);

  return {
    localRuntimeDiag,
    refreshLocalRuntimeDiagnose,
    waitForLocalRuntimeInstall,
  };
}
