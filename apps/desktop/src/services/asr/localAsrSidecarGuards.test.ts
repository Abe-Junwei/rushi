import { describe, expect, it } from "vitest";
import {
  isLoopbackTranscribeReadyForSelection,
  shouldSkipSidecarRestartForSelection,
} from "./localAsrSidecarGuards";

const selection = {
  selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
  catalogStatus: null,
  recognitionLanguage: "zh" as const,
};

const readyCaps = {
  ffmpeg_ok: true,
  funasr_import_ok: true,
  funasr_model_configured: true,
  funasr_default_model_cached: true,
  funasr_active_model_cached: true,
  funasr_vad_model_cached: true,
  funasr_required_models_cached: true,
  funasr_ready: true,
  ready_for_transcribe: true,
  transcription_mode: "funasr" as const,
  funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
  funasr_language: "zh",
};

describe("localAsrSidecarGuards", () => {
  it("isLoopbackTranscribeReadyForSelection matches ready caps", () => {
    expect(isLoopbackTranscribeReadyForSelection(readyCaps, selection)).toBe(true);
  });

  it("isLoopbackTranscribeReadyForSelection false when sidecar hub differs from UI", () => {
    expect(
      isLoopbackTranscribeReadyForSelection(
        { ...readyCaps, funasr_model_id: "iic/other" },
        selection,
      ),
    ).toBe(false);
  });

  it("shouldSkipSidecarRestartForSelection true on warm matching sidecar", () => {
    expect(shouldSkipSidecarRestartForSelection(readyCaps, selection)).toBe(true);
  });

  it("shouldSkipSidecarRestartForSelection false when funasr not ready", () => {
    expect(
      shouldSkipSidecarRestartForSelection({ ...readyCaps, funasr_ready: false }, selection),
    ).toBe(false);
  });

  it("shouldSkipSidecarRestartForSelection false when recognition language differs", () => {
    expect(
      shouldSkipSidecarRestartForSelection(
        { ...readyCaps, funasr_language: "auto" },
        { ...selection, recognitionLanguage: "zh" },
      ),
    ).toBe(false);
  });

  it("shouldSkipSidecarRestartForSelection false when loaded hub differs from config", () => {
    expect(
      shouldSkipSidecarRestartForSelection(
        {
          ...readyCaps,
          funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
          funasr_loaded_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        },
        {
          ...selection,
          selectedHubModelId:
            "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        },
      ),
    ).toBe(false);
  });

  it("shouldSkipSidecarRestartForSelection false when async transcribe missing", () => {
    expect(
      shouldSkipSidecarRestartForSelection(readyCaps, {
        ...selection,
        sidecarAsyncTranscribeCapable: false,
      }),
    ).toBe(false);
  });
});
