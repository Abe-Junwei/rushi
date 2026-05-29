import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
  LOCAL_ASR_MODEL_CATALOG,
  buildLocalAsrCatalogView,
  catalogEntryForHub,
  computeLocalAsrTranscribeReady,
  parseCatalogStatusFromHealth,
  resolveLocalAsrHubModelId,
  selectedModelPrepareState,
  hubModelNeedsPuncPrepare,
  sidecarSupportsPuncPrepareFromRoot,
} from "./localAsrModelCatalog";

describe("localAsrModelCatalog", () => {
  it("includes R3g-A curated models", () => {
    expect(LOCAL_ASR_MODEL_CATALOG).toHaveLength(2);
    expect(DEFAULT_LOCAL_ASR_HUB_MODEL_ID).toBe("iic/SenseVoiceSmall");
  });

  it("resolves hub model id with fallback", () => {
    const para =
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";
    expect(resolveLocalAsrHubModelId(null)).toBe(DEFAULT_LOCAL_ASR_HUB_MODEL_ID);
    expect(resolveLocalAsrHubModelId(para)).toBe(para);
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

  it("flags paraformer SKUs as needing punc prepare", () => {
    const para =
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";
    expect(hubModelNeedsPuncPrepare(para)).toBe(true);
    expect(hubModelNeedsPuncPrepare("iic/SenseVoiceSmall")).toBe(false);
  });

  it("parses catalog status from health json", () => {
    const parsed = parseCatalogStatusFromHealth({
      local_asr_model_catalog: [
        {
          catalog_id: "sensevoice-small",
          label: "SenseVoice 轻量（默认）",
          hub_model_id: "iic/SenseVoiceSmall",
          description: "快",
          disk_hint: "~1GB",
          recommend_long_audio: false,
          cached: true,
          active: true,
          ready_for_transcribe: true,
        },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0].readyForTranscribe).toBe(true);
    expect(catalogEntryForHub("iic/SenseVoiceSmall")?.catalogId).toBe("sensevoice-small");
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
    expect(view).toHaveLength(LOCAL_ASR_MODEL_CATALOG.length);
    expect(view[0].cached).toBe(true);
    expect(view[0].readyForTranscribe).toBe(true);
    expect(view[1].cached).toBe(false);
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
          catalogId: "sensevoice-small",
          label: "SenseVoice",
          hubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
          description: "",
          diskHint: "",
          recommendLongAudio: false,
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
    const para =
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";
    const view = buildLocalAsrCatalogView(
      {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_default_model_cached: true,
        funasr_required_models_cached: true,
      },
      null,
      para,
    );
    const state = selectedModelPrepareState(view, para, DEFAULT_LOCAL_ASR_HUB_MODEL_ID);
    expect(state.sidecarMatchesSelection).toBe(false);
    expect(state.readyForTranscribe).toBe(false);
    expect(state.cached).toBe(false);
  });

  it("computeLocalAsrTranscribeReady ignores global ready when sidecar mismatches selection", () => {
    const para =
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";
    const result = computeLocalAsrTranscribeReady({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
      },
      selectedHubModelId: para,
    });
    expect(result.sidecarMatchesSelection).toBe(false);
    expect(result.ready).toBe(false);
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

  it("computeLocalAsrTranscribeReady blocks when loaded memory mismatches config", () => {
    const para =
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";
    const result = computeLocalAsrTranscribeReady({
      asrHealth: "ok",
      asrCaps: {
        funasr_model_id: para,
        funasr_loaded_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
      },
      selectedHubModelId: para,
    });
    expect(result.sidecarMatchesSelection).toBe(true);
    expect(result.ready).toBe(false);
  });
});
