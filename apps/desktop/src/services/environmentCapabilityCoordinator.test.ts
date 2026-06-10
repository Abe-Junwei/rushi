import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AsrHealthRefreshResult } from "../pages/useAsrHealthPoll";
import {
  awaitEnvironmentCapabilityRefresh,
  getEnvironmentCapabilityBlockReason,
  resetEnvironmentCapabilityCoordinatorForTests,
  runEnvironmentCapabilityRefresh,
  syncEnvironmentCapabilityRefreshDeps,
} from "./environmentCapabilityCoordinator";

let mockHealthResult: AsrHealthRefreshResult | undefined;

const okHealthResult: AsrHealthRefreshResult = {
  health: "ok",
  healthDetail: "",
  caps: {
    ffmpeg_ok: true,
    funasr_import_ok: true,
    funasr_model_configured: true,
    funasr_ready: true,
    ready_for_transcribe: true,
    transcription_mode: "funasr",
    funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    funasr_loaded_model_id:
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
  },
  healthJson: {
    ready_for_transcribe: true,
    funasr_model_id:
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    local_asr_model_catalog: [],
  },
  rootJson: { transcribe: "POST /v1/transcribe/async" },
};

vi.mock("../pages/refreshLocalAsrDiagnostics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pages/refreshLocalAsrDiagnostics")>();
  return {
    ...actual,
    refreshLocalAsrDiagnostics: vi.fn(
      async (
        input: Parameters<typeof actual.refreshLocalAsrDiagnostics>[0],
        options?: Parameters<typeof actual.refreshLocalAsrDiagnostics>[1],
      ) => {
        await input.refreshAsrHealth({ touchUi: options?.touchUi ?? false });
        if (input.refreshAsrModelCacheInfo) await input.refreshAsrModelCacheInfo();
        if (input.refreshSetupDiagnose) {
          await input.refreshSetupDiagnose({
            resetSteps: false,
            touchUi: false,
            ...options?.setupDiagnose,
          });
        }
      },
    ),
    readLastAsrHealthRefreshResultAfterDiagnostics: () => mockHealthResult,
  };
});

describe("environmentCapabilityCoordinator", () => {
  beforeEach(() => {
    mockHealthResult = okHealthResult;
    resetEnvironmentCapabilityCoordinatorForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeDeps() {
    const refreshAsrHealth = vi.fn(() => Promise.resolve());
    const refreshAsrModelCacheInfo = vi.fn(() => Promise.resolve());
    const refreshSetupDiagnose = vi.fn(() => Promise.resolve(null));
    const bumpLlmRuntimeChanged = vi.fn();
    const bumpSttOnlineRuntimeChanged = vi.fn();
    const refreshLlmOllamaDetect = vi.fn(async () => {});

    return {
      refreshAsrHealth,
      refreshAsrModelCacheInfo,
      refreshSetupDiagnose,
      bumpLlmRuntimeChanged,
      bumpSttOnlineRuntimeChanged,
      refreshLlmOllamaDetect,
    };
  }

  it("coalesces concurrent refresh calls", async () => {
    const deps = makeDeps();
    const p1 = runEnvironmentCapabilityRefresh("manual", deps);
    const p2 = runEnvironmentCapabilityRefresh("manual", deps);
    await Promise.all([p1, p2]);
    expect(deps.refreshAsrHealth).toHaveBeenCalledTimes(1);
  });

  it("bumps runtime epochs and probes LLM on project open", async () => {
    const deps = makeDeps();
    await runEnvironmentCapabilityRefresh("project-open", deps);
    expect(deps.bumpLlmRuntimeChanged).toHaveBeenCalledTimes(1);
    expect(deps.bumpSttOnlineRuntimeChanged).toHaveBeenCalledTimes(1);
    expect(deps.refreshLlmOllamaDetect).toHaveBeenCalledTimes(1);
    expect(deps.refreshSetupDiagnose).toHaveBeenCalledWith({
      resetSteps: false,
      touchUi: true,
    });
  });

  it("throttles app-focus refresh", async () => {
    const deps = makeDeps();
    await runEnvironmentCapabilityRefresh("app-focus", deps);
    await runEnvironmentCapabilityRefresh("app-focus", deps);
    expect(deps.refreshAsrHealth).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    await runEnvironmentCapabilityRefresh("app-focus", deps);
    expect(deps.refreshAsrHealth).toHaveBeenCalledTimes(2);
  });

  it("stores blockReason snapshot for preflight", async () => {
    mockHealthResult = {
      health: "error",
      healthDetail: "sidecar down",
      caps: null,
      healthJson: null,
      rootJson: null,
    };
    const deps = makeDeps();
    await runEnvironmentCapabilityRefresh("manual", deps);
    expect(getEnvironmentCapabilityBlockReason()).toMatch(/ASR|连接|启动/);
  });

  it("awaitEnvironmentCapabilityRefresh reuses fresh snapshot", async () => {
    const deps = makeDeps();
    syncEnvironmentCapabilityRefreshDeps(deps);
    await runEnvironmentCapabilityRefresh("manual", deps);
    deps.refreshAsrHealth.mockClear();

    await awaitEnvironmentCapabilityRefresh();
    expect(deps.refreshAsrHealth).not.toHaveBeenCalled();
  });

  it("awaitEnvironmentCapabilityRefresh refreshes stale snapshot", async () => {
    const deps = makeDeps();
    syncEnvironmentCapabilityRefreshDeps(deps);
    await runEnvironmentCapabilityRefresh("manual", deps);
    deps.refreshAsrHealth.mockClear();

    vi.advanceTimersByTime(11_000);
    await awaitEnvironmentCapabilityRefresh();
    expect(deps.refreshAsrHealth).toHaveBeenCalledTimes(1);
    expect(deps.refreshSetupDiagnose).toHaveBeenLastCalledWith({
      resetSteps: false,
      touchUi: false,
    });
  });
});
