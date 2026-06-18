import { describe, expect, it, vi, beforeEach } from "vitest";
import { finishTranscribeSuccess } from "./transcribeJobExecuteFinish";

vi.mock("../services/ui/pushActivity", () => ({
  pushTranscribeOutcomeActivity: vi.fn(),
}));

vi.mock("../services/deliveryModeTranscribeToast", () => ({
  pushTranscribeDeliveryModeToast: vi.fn(),
}));

vi.mock("../services/onboarding/onboardingAutoSync", () => ({
  syncOnboardingTranscribe: vi.fn(),
}));

vi.mock("../tauri/projectApi", () => ({
  projectLoad: vi.fn(() => Promise.resolve({ id: "proj-1" })),
  getLastTranscribeTimeline: vi.fn(() => Promise.resolve(null)),
}));

import { pushTranscribeOutcomeActivity } from "../services/ui/pushActivity";
import { pushTranscribeDeliveryModeToast } from "../services/deliveryModeTranscribeToast";
import { syncOnboardingTranscribe } from "../services/onboarding/onboardingAutoSync";

function baseArgs() {
  return {
    fileId: "f1",
    out: {
      detail: { segments: [{ idx: 0, start_sec: 0, end_sec: 1, text: "你好" }] },
      warnings: [],
      engine: "test",
    },
    projectId: "proj-1",
    segmentPublish: {
      publishTextBulk: vi.fn(),
    },
    setCurrent: vi.fn(),
    resetMutationHistory: vi.fn(),
    openFileWrapped: vi.fn(() => Promise.resolve()),
    transcribeStartedAtMs: Date.now(),
    setTranscribeWarnings: vi.fn(),
    setTranscribeFailureDiag: vi.fn(),
    setTranscribeHints: vi.fn(),
    setError: vi.fn(),
  };
}

describe("finishTranscribeSuccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for empty outcome", async () => {
    const args = baseArgs();
    args.out.detail.segments = [];
    const ok = await finishTranscribeSuccess(
      args as unknown as Parameters<typeof finishTranscribeSuccess>[0],
    );
    expect(ok).toBe(false);
    expect(args.setError).toHaveBeenCalledWith("转写未产出可用语段。");
    expect(pushTranscribeOutcomeActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "warning",
        projectId: "proj-1",
        fileId: "f1",
      }),
    );
  });

  it("suppresses delivery toast when requested", async () => {
    const ok = await finishTranscribeSuccess({
      ...baseArgs(),
      suppressUserToasts: true,
    } as unknown as Parameters<typeof finishTranscribeSuccess>[0]);
    expect(ok).toBe(true);
    expect(pushTranscribeDeliveryModeToast).not.toHaveBeenCalled();
    expect(syncOnboardingTranscribe).not.toHaveBeenCalled();
  });
});
