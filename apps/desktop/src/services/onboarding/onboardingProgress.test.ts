import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOnboardingProgressForTests,
  dismissOnboardingChecklist,
  readOnboardingProgress,
  restoreOnboardingChecklist,
  shouldShowOnboardingChecklist,
} from "./onboardingProgress";

function mockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe("onboardingProgress", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
    clearOnboardingProgressForTests();
  });

  it("shows checklist until dismissed", () => {
    expect(shouldShowOnboardingChecklist(readOnboardingProgress())).toBe(true);
    dismissOnboardingChecklist();
    expect(shouldShowOnboardingChecklist(readOnboardingProgress())).toBe(false);
    restoreOnboardingChecklist();
    expect(shouldShowOnboardingChecklist(readOnboardingProgress())).toBe(true);
  });
});
