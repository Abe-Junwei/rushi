import type { OnboardingStepId } from "./onboardingChecklist";

const STORAGE_KEY = "rushi.onboarding.v1";
export const ONBOARDING_PROGRESS_CHANGED_EVENT = "rushi:onboarding-progress-changed";

function emitOnboardingProgressChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ONBOARDING_PROGRESS_CHANGED_EVENT));
  }
}

export type OnboardingProgress = {
  dismissed: boolean;
  completed: Partial<Record<OnboardingStepId, boolean>>;
};

const EMPTY: OnboardingProgress = { dismissed: false, completed: {} };

function isBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readOnboardingProgress(): OnboardingProgress {
  if (!isBrowserStorage()) return { ...EMPTY, completed: { ...EMPTY.completed } };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY, completed: {} };
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    return {
      dismissed: Boolean(parsed.dismissed),
      completed: { ...(parsed.completed ?? {}) },
    };
  } catch {
    return { ...EMPTY, completed: {} };
  }
}

export function writeOnboardingProgress(progress: OnboardingProgress): void {
  if (!isBrowserStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  emitOnboardingProgressChanged();
}

export function shouldShowOnboardingChecklist(progress: OnboardingProgress): boolean {
  return !progress.dismissed;
}

export function dismissOnboardingChecklist(): OnboardingProgress {
  const next = { ...readOnboardingProgress(), dismissed: true };
  writeOnboardingProgress(next);
  return next;
}

export function restoreOnboardingChecklist(): OnboardingProgress {
  const next = { ...readOnboardingProgress(), dismissed: false };
  writeOnboardingProgress(next);
  return next;
}

export function markOnboardingStepComplete(stepId: OnboardingStepId): OnboardingProgress {
  const current = readOnboardingProgress();
  const next: OnboardingProgress = {
    ...current,
    completed: { ...current.completed, [stepId]: true },
  };
  writeOnboardingProgress(next);
  return next;
}

/** Test helper */
export function clearOnboardingProgressForTests(): void {
  if (!isBrowserStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
