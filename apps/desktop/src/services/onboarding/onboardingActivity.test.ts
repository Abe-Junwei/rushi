import { describe, expect, it } from "vitest";
import { countPendingOnboardingSteps, listPendingOnboardingSteps } from "./onboardingActivity";

describe("onboardingActivity", () => {
  it("counts only required incomplete steps", () => {
    const progress = {
      dismissed: false,
      completed: { asr_ready: true, metadata: true },
    };
    expect(countPendingOnboardingSteps(progress)).toBe(3);
    const pending = listPendingOnboardingSteps(progress);
    expect(pending.map((s) => s.id)).toEqual(["project_audio", "transcribe", "export"]);
  });

  it("hides pending steps when checklist dismissed", () => {
    const progress = {
      dismissed: true,
      completed: {},
    };
    expect(listPendingOnboardingSteps(progress)).toEqual([]);
    expect(countPendingOnboardingSteps(progress)).toBe(0);
  });
});
