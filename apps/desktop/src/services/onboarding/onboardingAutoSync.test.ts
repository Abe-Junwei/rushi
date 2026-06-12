import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeOnboardingStepIfNeeded,
  syncOnboardingAsrReady,
  syncOnboardingExport,
  syncOnboardingTranscribe,
} from "./onboardingAutoSync";
import { clearOnboardingProgressForTests, readOnboardingProgress } from "./onboardingProgress";

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

describe("onboardingAutoSync", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
    clearOnboardingProgressForTests();
  });

  it("marks asr_ready once when ready", () => {
    syncOnboardingAsrReady(true);
    expect(readOnboardingProgress().completed.asr_ready).toBe(true);
    syncOnboardingAsrReady(true);
    expect(Object.keys(readOnboardingProgress().completed)).toEqual(["asr_ready"]);
  });

  it("marks transcribe and export idempotently", () => {
    syncOnboardingTranscribe();
    syncOnboardingExport();
    expect(readOnboardingProgress().completed.transcribe).toBe(true);
    expect(readOnboardingProgress().completed.export).toBe(true);
    completeOnboardingStepIfNeeded("transcribe");
    expect(Object.keys(readOnboardingProgress().completed).sort()).toEqual(["export", "transcribe"]);
  });
});
