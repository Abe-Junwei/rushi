import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./localAsrSetupModelStep", () => ({
  snapshotSelectedModelPrepare: vi.fn(),
  syncBundledSidecarToPreferredHub: vi.fn(async () => true),
}));

vi.mock("../../config/env", () => ({
  isDefaultBundledAsrTarget: () => true,
}));

import { finishOneClickIfAlreadyReady } from "./asrOneClickPrepareReady";
import { snapshotSelectedModelPrepare } from "./localAsrSetupModelStep";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";
import type { AsrSetupReport } from "./asrSetupContract";

const snapshotSelectedModelPrepareMock = vi.mocked(snapshotSelectedModelPrepare);

function baseReport(mode: string): AsrSetupReport {
  return {
    portStatus: "rushi_asr",
    bundledAvailable: true,
    sidecarIntegrity: "corrupt",
    bundledLaunch: { attempted: true, success: true },
    supervisor: {
      runtimeSessionId: "s",
      launchGeneration: 1,
      phase: "ready",
      executableSource: "bundled_media",
      loopbackPort: 8741,
      healthFresh: true,
      localTokenManaged: false,
      lastTransitionMs: 0,
      warmupCompleted: false,
      lastActivityMs: 0,
    },
    health: {
      healthReachable: true,
      ffmpegOk: true,
      funasrImportOk: false,
      funasrReady: false,
      funasrDefaultModelCached: true,
      funasrVadModelCached: true,
      funasrRequiredModelsCached: true,
      readyForTranscribe: false,
      selectedModelReady: false,
      transcriptionMode: mode,
    },
    modelsRoot: "/tmp",
    diskLow: false,
    readyForTranscribe: false,
    summaryLines: ["内置侧车包可能损坏"],
    blockingIssue: "内置侧车包可能损坏",
  };
}

describe("finishOneClickIfAlreadyReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not short-circuit when disk is cached but mode is still stub", async () => {
    snapshotSelectedModelPrepareMock.mockResolvedValue({
      hub: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      modelLabel: "Paraformer",
      ready: false,
      diskPrepared: true,
      sidecarMatchesSelection: true,
    });
    const setSetupOutcome = vi.fn();
    const result = await finishOneClickIfAlreadyReady(
      { refreshAsrRuntimeInfo: vi.fn(async () => undefined) } as never,
      {
        setSetupSteps: vi.fn(),
        setSetupMessage: vi.fn(),
        setSetupOutcome,
      },
      baseReport("stub"),
      { selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID },
    );
    expect(result).toBe(false);
    expect(setSetupOutcome).not.toHaveBeenCalled();
  });
});
