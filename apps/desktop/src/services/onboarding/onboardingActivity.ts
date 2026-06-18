import { ONBOARDING_STEPS, type OnboardingStepDef } from "./onboardingChecklist";
import type { OnboardingProgress } from "./onboardingProgress";

export function listPendingOnboardingSteps(progress: OnboardingProgress): OnboardingStepDef[] {
  if (progress.dismissed) return [];
  return ONBOARDING_STEPS.filter((step) => !step.optional && !progress.completed[step.id]);
}

export function countPendingOnboardingSteps(progress: OnboardingProgress): number {
  return listPendingOnboardingSteps(progress).length;
}
