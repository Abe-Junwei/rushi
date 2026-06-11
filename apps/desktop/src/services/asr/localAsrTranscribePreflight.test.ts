import { describe, expect, it } from "vitest";
import { localAsrTranscribePreflightMessage } from "./localAsrTranscribePreflight";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";

describe("localAsrTranscribePreflightMessage", () => {
  it("returns null when ready", () => {
    const msg = localAsrTranscribePreflightMessage({
      asrHealth: "ok",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_loaded_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: true,
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      catalogStatus: [
        {
          catalogId: "paraformer-long-vad-punc",
          label: "Paraformer 长音频（推荐转写）",
          hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
          description: "",
          diskHint: "",
          recommendLongAudio: true,
          cached: true,
          active: true,
          readyForTranscribe: true,
        },
      ],
    });
    expect(msg).toBeNull();
  });

  it("blocks hub mismatch", () => {
    const msg = localAsrTranscribePreflightMessage({
      asrHealth: "ok",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_loaded_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: true,
      },
      selectedHubModelId: "Qwen/Qwen3-ASR-0.6B",
      catalogStatus: [],
    });
    expect(msg).toContain("不一致");
  });

  it("blocks stale sidecar without async transcribe", () => {
    const msg = localAsrTranscribePreflightMessage({
      asrHealth: "ok",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_loaded_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: true,
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      catalogStatus: [],
      sidecarAsyncTranscribeCapable: false,
    });
    expect(msg).toContain("async 转写");
  });
});
