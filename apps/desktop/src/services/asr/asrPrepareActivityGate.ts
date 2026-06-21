/** True while sidecar model download poll is active (suppress transient /health errors). */
let modelPrepareActive = false;
/** True while offline ASR model pack is being imported (Route E). */
let offlinePackImportActive = false;

export function setAsrModelPrepareActive(active: boolean): void {
  modelPrepareActive = active;
}

export function isAsrModelPrepareActive(): boolean {
  return modelPrepareActive;
}

export function setOfflineAsrModelsPackImportActive(active: boolean): void {
  offlinePackImportActive = active;
}

export function isOfflineAsrModelsPackImportActive(): boolean {
  return offlinePackImportActive;
}
