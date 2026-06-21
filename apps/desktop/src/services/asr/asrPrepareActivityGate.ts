/** True while sidecar model download poll is active (suppress transient /health errors). */
let modelPrepareActive = false;
/** True while bundled ASR models seed runs (Plan B). */
let bundledSeedActive = false;

export function setAsrModelPrepareActive(active: boolean): void {
  modelPrepareActive = active;
}

export function isAsrModelPrepareActive(): boolean {
  return modelPrepareActive;
}

export function setBundledAsrModelsSeedActive(active: boolean): void {
  bundledSeedActive = active;
}

export function isBundledAsrModelsSeedActive(): boolean {
  return bundledSeedActive;
}
