import { describe, expect, it } from "vitest";
import { funasrManualSetupCommands, parseAsrHealthJson } from "./useProjectController";

describe("parseAsrHealthJson", () => {
  it("returns null for non-objects", () => {
    expect(parseAsrHealthJson(null)).toBeNull();
    expect(parseAsrHealthJson("ok")).toBeNull();
    expect(parseAsrHealthJson(42)).toBeNull();
  });

  it("returns null when status is not 'ok'", () => {
    expect(parseAsrHealthJson({ status: "error", service: "rushi-asr" })).toBeNull();
    expect(parseAsrHealthJson({ service: "rushi-asr" })).toBeNull();
  });

  it("returns null when service is not 'rushi-asr'", () => {
    expect(parseAsrHealthJson({ status: "ok", service: "other" })).toBeNull();
  });

  it("parses minimal ok payload with defaults", () => {
    const result = parseAsrHealthJson({ status: "ok", service: "rushi-asr" });
    expect(result).toEqual({
      ffmpeg_ok: false,
      funasr_import_ok: false,
      funasr_model_configured: false,
      funasr_model_explicit_from_env: false,
      funasr_default_model_cached: false,
      funasr_active_model_cached: false,
      funasr_vad_model_cached: false,
      funasr_punc_model_cached: undefined,
      funasr_required_models_cached: false,
      funasr_ready: false,
      ready_for_transcribe: false,
      transcription_mode: "stub",
      funasr_model_id: null,
      funasr_loaded_model_id: null,
      funasr_language: null,
      funasr_punc_model_id: null,
      rushi_models_root: null,
    });
  });

  it("parses full ok payload", () => {
    const result = parseAsrHealthJson({
      status: "ok",
      service: "rushi-asr",
      ffmpeg_ok: true,
      funasr_import_ok: true,
      funasr_model_configured: true,
      funasr_model_explicit_from_env: true,
      funasr_default_model_cached: true,
      funasr_active_model_cached: false,
      funasr_vad_model_cached: false,
      funasr_required_models_cached: false,
      funasr_ready: true,
      ready_for_transcribe: false,
      transcription_mode: "funasr",
      funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      rushi_models_root: "/tmp/models",
    });
    expect(result).toEqual({
      ffmpeg_ok: true,
      funasr_import_ok: true,
      funasr_model_configured: true,
      funasr_model_explicit_from_env: true,
      funasr_default_model_cached: true,
      funasr_active_model_cached: false,
      funasr_vad_model_cached: false,
      funasr_punc_model_cached: undefined,
      funasr_required_models_cached: false,
      funasr_ready: true,
      ready_for_transcribe: false,
      transcription_mode: "funasr",
      funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      funasr_loaded_model_id: null,
      funasr_language: null,
      funasr_punc_model_id: null,
      rushi_models_root: "/tmp/models",
    });
  });

  it("coerces unknown transcription_mode to stub", () => {
    const result = parseAsrHealthJson({
      status: "ok",
      service: "rushi-asr",
      transcription_mode: "unknown",
    });
    expect(result?.transcription_mode).toBe("stub");
  });
});

describe("funasrManualSetupCommands", () => {
  it("returns multi-line shell commands", () => {
    const text = funasrManualSetupCommands();
    expect(text).toContain("cd services/asr");
    expect(text).toContain("source .venv/bin/activate");
    expect(text).toContain('pip install -e ".[funasr]"');
    expect(text).toContain("python -m rushi_asr");
  });
});
