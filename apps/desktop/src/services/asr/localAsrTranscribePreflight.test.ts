import { describe, expect, it } from "vitest";
import { localAsrTranscribePreflightMessage } from "./localAsrTranscribePreflight";

describe("localAsrTranscribePreflightMessage", () => {
  it("returns null when ready", () => {
    const msg = localAsrTranscribePreflightMessage({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: "iic/SenseVoiceSmall",
        funasr_loaded_model_id: "iic/SenseVoiceSmall",
        ready_for_transcribe: true,
      },
      selectedHubModelId: "iic/SenseVoiceSmall",
      catalogStatus: [
        {
          catalogId: "sensevoice-small",
          label: "SenseVoice",
          hubModelId: "iic/SenseVoiceSmall",
          description: "",
          diskHint: "",
          recommendLongAudio: false,
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
        funasr_model_id: "iic/SenseVoiceSmall",
        funasr_loaded_model_id: "iic/SenseVoiceSmall",
        ready_for_transcribe: true,
      },
      selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      catalogStatus: [],
    });
    expect(msg).toContain("不一致");
  });

  it("blocks stale sidecar without async transcribe", () => {
    const msg = localAsrTranscribePreflightMessage({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: "iic/SenseVoiceSmall",
        funasr_loaded_model_id: "iic/SenseVoiceSmall",
        ready_for_transcribe: true,
      },
      selectedHubModelId: "iic/SenseVoiceSmall",
      catalogStatus: [],
      sidecarAsyncTranscribeCapable: false,
    });
    expect(msg).toContain("transcribe/async");
  });
});
