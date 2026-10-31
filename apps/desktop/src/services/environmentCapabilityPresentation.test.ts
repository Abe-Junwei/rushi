import { describe, expect, it } from "vitest";
import { buildEnvironmentCapabilityPresentation } from "./environmentCapabilityPresentation";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./asr/localAsrModelCatalog";

describe("buildEnvironmentCapabilityPresentation", () => {
  it("does not let overlay async=false shadow a fresh root that declares async", () => {
    const p = buildEnvironmentCapabilityPresentation({
      healthResult: {
        health: "ok",
        healthDetail: "",
        caps: {
          ffmpeg_ok: true,
          funasr_import_ok: true,
          funasr_model_configured: true,
          funasr_ready: true,
          funasr_required_models_cached: true,
          ready_for_transcribe: true,
          transcription_mode: "funasr",
          funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        },
        healthJson: {},
        rootJson: {
          transcribe_async: "POST /v1/transcribe/async + GET /v1/transcribe/status",
        },
      },
      asrOverlay: {
        selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        // React state default / lag — must not win over rootJson.
        sidecarAsyncTranscribeCapable: false,
      },
    });
    expect(p.blockReason).toBeNull();
    expect(p.transcribeReady).toBe(true);
  });

  it("blocks when root is present but lacks async docs", () => {
    const p = buildEnvironmentCapabilityPresentation({
      healthResult: {
        health: "ok",
        healthDetail: "",
        caps: {
          ffmpeg_ok: true,
          funasr_import_ok: true,
          funasr_model_configured: true,
          funasr_ready: true,
          funasr_required_models_cached: true,
          ready_for_transcribe: true,
          transcription_mode: "funasr",
          funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        },
        healthJson: {},
        rootJson: { service: "rushi-asr" },
      },
      asrOverlay: {
        selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        sidecarAsyncTranscribeCapable: true,
      },
    });
    expect(p.blockReason).toMatch(/侧车版本过旧|async/);
  });
});
