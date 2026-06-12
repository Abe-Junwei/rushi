import type { OnboardingStepId } from "./onboardingChecklist";
import { markOnboardingStepComplete, readOnboardingProgress } from "./onboardingProgress";

export function completeOnboardingStepIfNeeded(stepId: OnboardingStepId): void {
  const current = readOnboardingProgress();
  if (current.completed[stepId]) return;
  markOnboardingStepComplete(stepId);
}

export function syncOnboardingAsrReady(ready: boolean): void {
  if (ready) completeOnboardingStepIfNeeded("asr_ready");
}

export function syncOnboardingProjectAudio(hasProjectWithAudio: boolean): void {
  if (hasProjectWithAudio) completeOnboardingStepIfNeeded("project_audio");
}

export function syncOnboardingTranscribe(): void {
  completeOnboardingStepIfNeeded("transcribe");
}

export function syncOnboardingMetadata(hasMetadata: boolean): void {
  if (hasMetadata) completeOnboardingStepIfNeeded("metadata");
}

export function syncOnboardingExport(): void {
  completeOnboardingStepIfNeeded("export");
}
