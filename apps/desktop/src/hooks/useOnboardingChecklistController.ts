import { useCallback, useEffect, useMemo, useState } from "react";
import type { OnboardingProgress } from "../services/onboarding/onboardingProgress";
import {
  dismissOnboardingChecklist,
  ONBOARDING_PROGRESS_CHANGED_EVENT,
  readOnboardingProgress,
  restoreOnboardingChecklist,
  shouldShowOnboardingChecklist,
} from "../services/onboarding/onboardingProgress";

export function useOnboardingChecklistController() {
  const [progress, setProgress] = useState<OnboardingProgress>(() => readOnboardingProgress());

  const visible = useMemo(() => shouldShowOnboardingChecklist(progress), [progress]);

  const dismiss = useCallback(() => {
    setProgress(dismissOnboardingChecklist());
  }, []);

  const restore = useCallback(() => {
    setProgress(restoreOnboardingChecklist());
  }, []);

  const refresh = useCallback(() => {
    setProgress(readOnboardingProgress());
  }, []);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(ONBOARDING_PROGRESS_CHANGED_EVENT, onChanged);
  }, [refresh]);

  return {
    progress,
    visible,
    dismiss,
    restore,
    refresh,
  };
}
