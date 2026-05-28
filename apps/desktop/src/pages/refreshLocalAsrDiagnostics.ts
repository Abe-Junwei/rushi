/** Refresh ASR health, model cache, and Tauri setup diagnose (no wizard UI reset). */
export async function refreshLocalAsrDiagnostics(input: {
  refreshAsrHealth: () => Promise<void>;
  refreshAsrModelCacheInfo?: () => Promise<void>;
  refreshSetupDiagnose?: (options?: {
    resetSteps?: boolean;
    touchUi?: boolean;
  }) => Promise<unknown>;
}): Promise<void> {
  await input.refreshAsrHealth();
  if (input.refreshAsrModelCacheInfo) {
    await input.refreshAsrModelCacheInfo();
  }
  if (input.refreshSetupDiagnose) {
    await input.refreshSetupDiagnose({ resetSteps: false, touchUi: false });
  }
}
