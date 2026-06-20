/** True while sidecar model download poll is active (suppress transient /health errors). */
let modelPrepareActive = false;

export function setAsrModelPrepareActive(active: boolean): void {
  modelPrepareActive = active;
}

export function isAsrModelPrepareActive(): boolean {
  return modelPrepareActive;
}
