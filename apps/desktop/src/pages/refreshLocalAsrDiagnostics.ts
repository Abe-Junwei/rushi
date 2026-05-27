/** Refresh ASR health, model cache, and Tauri setup diagnose (no step reset). */
export async function refreshLocalAsrDiagnostics(input: {
  refreshAsrHealth: () => Promise<void>;
  refreshAsrModelCacheInfo?: () => Promise<void>;
  refreshSetupDiagnose?: (options?: { resetSteps?: boolean }) => Promise<unknown>;
}): Promise<void> {
  await input.refreshAsrHealth();
  if (input.refreshAsrModelCacheInfo) {
    await input.refreshAsrModelCacheInfo();
  }
  if (input.refreshSetupDiagnose) {
    await input.refreshSetupDiagnose({ resetSteps: false });
  }
}
