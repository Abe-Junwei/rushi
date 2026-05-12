import { describe, expect, it } from "vitest";
import { parseAsrHealthJson } from "../pages/useProjectP1Controller";

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
      funasr_ready: false,
      transcription_mode: "stub",
      funasr_model_id: "iic/SenseVoiceSmall",
      rushi_models_root: "/tmp/models",
    });
    expect(caps).not.toBeNull();
    expect(caps!.funasr_default_model_cached).toBe(false);
    expect(caps!.rushi_models_root).toBe("/tmp/models");
  });

  it("returns null for invalid payload", () => {
    const caps = parseAsrHealthJson({
      status: "ok",
      service: "other-service",
    });
    expect(caps).toBeNull();
  });
});
