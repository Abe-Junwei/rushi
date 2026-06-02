import { describe, expect, it } from "vitest";
import { sidecarConfigMatchesHub } from "./localAsrSidecarRestart";

describe("sidecarConfigMatchesHub", () => {
  const hub = "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";

  it("matches configured hub and language", () => {
    expect(
      sidecarConfigMatchesHub(
        {
          funasr_model_id: hub,
          funasr_language: "zh",
        } as never,
        hub,
        "zh",
      ),
    ).toBe(true);
  });

  it("false when loaded hub still differs", () => {
    expect(
      sidecarConfigMatchesHub(
        {
          funasr_model_id: hub,
          funasr_loaded_model_id: "iic/SenseVoiceSmall",
          funasr_language: "zh",
        } as never,
        hub,
        "zh",
      ),
    ).toBe(false);
  });
});
