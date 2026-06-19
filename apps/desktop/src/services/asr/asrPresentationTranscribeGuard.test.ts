import { describe, expect, it } from "vitest";
import type { AsrEnvPresentation } from "./asrEnvStatus";
import { stabilizeAsrPresentationDuringTranscribe } from "./asrPresentationTranscribeGuard";

function presentation(chipOk: boolean): AsrEnvPresentation {
  return {
    health: chipOk ? "ok" : "error",
    transcribeReady: chipOk,
    sidecarMatchesSelection: chipOk,
    ffmpegOk: chipOk,
    envOk: chipOk,
    runtimeReady: chipOk,
    tone: chipOk ? "ok" : "error",
    chipLabel: chipOk ? "ASR 就绪" : "ASR 未就绪",
    chipOk,
    chipTitle: "",
    ffmpegChipOk: chipOk,
    ffmpegChipTitle: "",
    statusRows: [],
    bannerTitle: "",
    bannerDetail: "",
    blockReason: chipOk ? null : "blocked",
    errorDetail: null,
    errorBannerMessage: "",
    connectedGuidance: null,
    ffmpegWarning: null,
    cachePathMismatch: false,
    cachePathMismatchDetail: null,
    modelsOnDiskButSidecarBlind: false,
    modelsOnDiskButSidecarBlindDetail: null,
  };
}

describe("stabilizeAsrPresentationDuringTranscribe", () => {
  it("keeps last stable ready presentation while transcribing", () => {
    const stable = presentation(true);
    const degraded = presentation(false);
    expect(stabilizeAsrPresentationDuringTranscribe(degraded, stable, true)).toBe(stable);
  });

  it("shows degraded presentation when not transcribing", () => {
    const stable = presentation(true);
    const degraded = presentation(false);
    expect(stabilizeAsrPresentationDuringTranscribe(degraded, stable, false)).toBe(degraded);
  });
});
