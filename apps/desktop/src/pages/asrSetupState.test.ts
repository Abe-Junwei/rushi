import { describe, expect, it } from "vitest";
import { outcomeFromReport } from "./asrSetupState";
import type { AsrSetupReport } from "../services/asr/asrSetupContract";

function makeReport(overrides: Partial<AsrSetupReport> = {}): AsrSetupReport {
  return {
    portStatus: "rushi_asr",
    bundledAvailable: true,
    sidecarIntegrity: "ok",
    bundledLaunch: { attempted: false, success: false },
    health: {
      healthReachable: false,
      ffmpegOk: false,
      funasrImportOk: false,
      funasrReady: false,
      funasrDefaultModelCached: false,
      funasrVadModelCached: false,
      funasrRequiredModelsCached: false,
      readyForTranscribe: false,
      transcriptionMode: "stub",
    },
    modelsRoot: "/tmp/models",
    diskFreeBytes: null,
    diskLow: false,
    readyForTranscribe: false,
    summaryLines: [],
    blockingIssue: null,
    ...overrides,
  };
}

describe("outcomeFromReport", () => {
  it("returns error for corrupt or unhealthy reports without a blocking issue", () => {
    expect(outcomeFromReport(makeReport({ sidecarIntegrity: "corrupt" }))).toBe("error");
    expect(
      outcomeFromReport(
        makeReport({
          health: {
            healthReachable: true,
            ffmpegOk: true,
            funasrImportOk: true,
            funasrReady: false,
            funasrDefaultModelCached: false,
            funasrVadModelCached: false,
            funasrRequiredModelsCached: false,
            readyForTranscribe: false,
            transcriptionMode: "stub",
          },
        }),
      ),
    ).toBe("error");
  });
});
