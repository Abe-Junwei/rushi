import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
  DEPRECATED_LOCAL_ASR_HUB_MODEL_IDS,
  LOCAL_ASR_MODEL_CATALOG,
  buildLocalAsrCatalogView,
  catalogEntryForHub,
  computeLocalAsrTranscribeReady,
  migrateDeprecatedHubModelId,
  parseCatalogStatusFromHealth,
  resolveLocalAsrHubModelId,
  selectedModelPrepareState,
  hubModelNeedsPuncPrepare,
  sidecarSupportsPuncPrepareFromRoot,
  sidecarSupportsTranscribeAsyncFromRoot,
} from "./localAsrModelCatalog";

describe("localAsrModelCatalog", () => {
  it("includes R3g-A curated Paraformer SKU only", () => {
    expect(LOCAL_ASR_MODEL_CATALOG).toHaveLength(1);
    expect(DEFAULT_LOCAL_ASR_HUB_MODEL_ID).toBe(
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    );
    expect(catalogEntryForHub("iic/SenseVoiceSmall")?.catalogId).toBe("paraformer-long-vad-punc");
  });

  it("migrates deprecated SenseVoice hub id to Paraformer default", () => {
    expect(migrateDeprecatedHubModelId("iic/SenseVoiceSmall")).toBe(
      DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    );
    expect(resolveLocalAsrHubModelId("iic/SenseVoiceSmall")).toBe(
      DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    );
    expect(DEPRECATED_LOCAL_ASR_HUB_MODEL_IDS).toContain("iic/SenseVoiceSmall");
  });

  it("Paraformer label recommends long audio", () => {
    const paraformer = catalogEntryForHub(DEFAULT_LOCAL_ASR_HUB_MODEL_ID);
    expect(paraformer?.label).toContain("推荐转写");
  });

  it("resolves hub model id with fallback", () => {
    expect(resolveLocalAsrHubModelId(null)).toBe(DEFAULT_LOCAL_ASR_HUB_MODEL_ID);
    expect(resolveLocalAsrHubModelId(DEFAULT_LOCAL_ASR_HUB_MODEL_ID)).toBe(
      DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    );
  });

  it("detects punc-prepare capability from sidecar root", () => {
    expect(
      sidecarSupportsPuncPrepareFromRoot({
        prepare_cancel: "POST /v1/models/prepare-cancel",
      }),
    ).toBe(true);
    expect(sidecarSupportsPuncPrepareFromRoot({ model_catalog: "GET /v1/models/catalog" })).toBe(
      false,
    );
  });

  it("detects async transcribe capability from sidecar root", () => {
    expect(
      sidecarSupportsTranscribeAsyncFromRoot({
        transcribe_async: "POST /v1/transcribe/async + GET /v1/transcribe/status",
      }),
    ).toBe(true);
    expect(sidecarSupportsTranscribeAsyncFromRoot({ transcribe: "POST /v1/transcribe" })).toBe(
      false,
    );
  });

  it("flags paraformer SKUs as needing punc prepare", () => {
    expect(hubModelNeedsPuncPrepare(DEFAULT_LOCAL_ASR_HUB_MODEL_ID)).toBe(true);
    expect(hubModelNeedsPuncPrepare("iic/SenseVoiceSmall")).toBe(true);
  });

  it("parses catalog status from health json", () => {
    const parsed = parseCatalogStatusFromHealth({
      local_asr_model_catalog: [
        {
          catalog_id: "paraformer-long-vad-punc",
          label: "Paraformer 长音频（推荐转写）",
          hub_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
          description: "长音频",
          disk_hint: "~2GB",
          recommend_long_audio: true,
          cached: true,
          active: true,
          ready_for_transcribe: true,
        },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0].readyForTranscribe).toBe(true);
  });

  it("builds full catalog view with caps fallback when server status missing", () => {
    const view = buildLocalAsrCatalogView(
      {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_default_model_cached: true,
        funasr_active_model_cached: true,
        funasr_required_models_cached: true,
      },
      null,
      DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    );
    expect(view).toHaveLength(1);
    expect(view[0].cached).toBe(true);
    expect(view[0].readyForTranscribe).toBe(true);
  });

  it("prefers caps when server catalog marks cached false", () => {
    const view = buildLocalAsrCatalogView(
      {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_default_model_cached: true,
        funasr_required_models_cached: true,
      },
      [
        {
          catalogId: "paraformer-long-vad-punc",
          label: "Paraformer",
          hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
          description: "",
          diskHint: "",
          recommendLongAudio: true,
          cached: false,
          active: true,
          readyForTranscribe: false,
        },
      ],
      DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    );
    expect(view[0].cached).toBe(true);
    expect(view[0].readyForTranscribe).toBe(true);
  });

  it("selectedModelPrepareState respects sidecar mismatch", () => {
    const other = "Qwen/Qwen3-ASR-0.6B";
    const view = buildLocalAsrCatalogView(
      {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_default_model_cached: true,
        funasr_required_models_cached: true,
      },
      null,
      other,
    );
    const state = selectedModelPrepareState(view, other, DEFAULT_LOCAL_ASR_HUB_MODEL_ID);
    expect(state.sidecarMatchesSelection).toBe(false);
    expect(state.readyForTranscribe).toBe(false);
  });

  it("computeLocalAsrTranscribeReady is true when sidecar matches and SKU ready", () => {
    const result = computeLocalAsrTranscribeReady({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_default_model_cached: true,
        funasr_active_model_cached: true,
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(result.sidecarMatchesSelection).toBe(true);
    expect(result.ready).toBe(true);
  });

  it("computeLocalAsrTranscribeReady ignores global ready when selected SKU is not ready", () => {
    const result = computeLocalAsrTranscribeReady({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_active_model_cached: true,
        ready_for_transcribe: true,
      },
      catalogStatus: [
        {
          catalogId: "paraformer-long-vad-punc",
          label: "Paraformer",
          hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
          description: "",
          diskHint: "",
          recommendLongAudio: true,
          cached: true,
          active: true,
          readyForTranscribe: false,
        },
      ],
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(result.sidecarMatchesSelection).toBe(true);
    expect(result.ready).toBe(false);
  });

  it("computeLocalAsrTranscribeReady treats deprecated sidecar id as matching Paraformer selection", () => {
    const result = computeLocalAsrTranscribeReady({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: "iic/SenseVoiceSmall",
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(result.sidecarMatchesSelection).toBe(true);
  });

  it("computeLocalAsrTranscribeReady blocks when loaded memory mismatches config", () => {
    const result = computeLocalAsrTranscribeReady({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_loaded_model_id: "Qwen/Qwen3-ASR-0.6B",
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(result.sidecarMatchesSelection).toBe(true);
    expect(result.ready).toBe(false);
  });
});
