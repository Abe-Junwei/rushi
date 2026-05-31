import { describe, expect, it } from "vitest";
import { parseAsrHealthJson } from "../pages/useProjectController";

describe("parseAsrHealthJson", () => {
  it("parses extended health fields", () => {
    const caps = parseAsrHealthJson({
      status: "ok",
      service: "rushi-asr",
      ffmpeg_ok: true,
      funasr_import_ok: false,
      funasr_model_configured: true,
      funasr_model_explicit_from_env: false,
      funasr_default_model_cached: false,
      funasr_vad_model_cached: false,
      funasr_required_models_cached: false,
      funasr_ready: false,
      ready_for_transcribe: false,
      transcription_mode: "stub",
      funasr_model_id: "iic/SenseVoiceSmall",
      rushi_models_root: "/tmp/models",
    });
    expect(caps).not.toBeNull();
    expect(caps!.funasr_default_model_cached).toBe(false);
    expect(caps!.funasr_required_models_cached).toBe(false);
    expect(caps!.rushi_models_root).toBe("/tmp/models");
  });

  it("parses punc model health fields", () => {
    const caps = parseAsrHealthJson({
      status: "ok",
      service: "rushi-asr",
      ffmpeg_ok: true,
      funasr_import_ok: true,
      funasr_model_configured: true,
      funasr_ready: true,
      ready_for_transcribe: true,
      transcription_mode: "funasr",
      funasr_model_id:
        "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      funasr_punc_model_id: "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch",
      funasr_punc_model_cached: true,
    });
    expect(caps?.funasr_punc_model_id).toContain("punc_ct-transformer");
    expect(caps?.funasr_punc_model_cached).toBe(true);
  });

  it("parses funasr_language (R3g-C D2)", () => {
    const caps = parseAsrHealthJson({
      status: "ok",
      service: "rushi-asr",
      ffmpeg_ok: true,
      funasr_import_ok: true,
      funasr_model_configured: true,
      funasr_ready: true,
      ready_for_transcribe: true,
      transcription_mode: "funasr",
      funasr_model_id: "iic/SenseVoiceSmall",
      funasr_language: "auto",
    });
    expect(caps?.funasr_language).toBe("auto");
  });

  it("parses loaded model id", () => {
    const caps = parseAsrHealthJson({
      status: "ok",
      service: "rushi-asr",
      ffmpeg_ok: true,
      funasr_import_ok: true,
      funasr_model_configured: true,
      funasr_ready: true,
      ready_for_transcribe: true,
      transcription_mode: "funasr",
      funasr_model_id: "iic/SenseVoiceSmall",
      funasr_loaded_model_id: "iic/SenseVoiceSmall",
    });
    expect(caps?.funasr_loaded_model_id).toBe("iic/SenseVoiceSmall");
  });

  it("returns null for invalid payload", () => {
    const caps = parseAsrHealthJson({
      status: "ok",
      service: "other-service",
    });
    expect(caps).toBeNull();
  });
});
