import type { AsrHealthRefreshOptions } from "./useAsrHealthPoll";
import { getLastAsrHealthRefreshResult } from "./useAsrHealthPoll";

/** Refresh ASR health, model cache, and Tauri setup diagnose (no wizard UI reset). */
export async function refreshLocalAsrDiagnostics(
  input: {
    refreshAsrHealth: (options?: AsrHealthRefreshOptions) => Promise<void>;
    refreshAsrModelCacheInfo?: () => Promise<unknown>;
    refreshSetupDiagnose?: (options?: {
      resetSteps?: boolean;
      touchUi?: boolean;
    }) => Promise<unknown>;
  },
  options?: {
    touchUi?: boolean;
    setupDiagnose?: {
      resetSteps?: boolean;
      touchUi?: boolean;
    };
  },
): Promise<void> {
  await input.refreshAsrHealth({
    touchUi: options?.touchUi ?? false,
  });
  if (input.refreshAsrModelCacheInfo) {
    await input.refreshAsrModelCacheInfo();
  }
  if (input.refreshSetupDiagnose) {
    await input.refreshSetupDiagnose({
      resetSteps: false,
      touchUi: false,
      ...options?.setupDiagnose,
    });
  }
}

export function readLastAsrHealthRefreshResultAfterDiagnostics(): ReturnType<
  typeof getLastAsrHealthRefreshResult
> {
  return getLastAsrHealthRefreshResult();
}
