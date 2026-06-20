import { describe, expect, it } from "vitest";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import { buildAsrCatalogPresentation } from "./asrCatalogPresentation";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";

function caps(partial: Partial<AsrHealthCapabilities>): AsrHealthCapabilities {
  return {
    ffmpeg_ok: true,
    funasr_import_ok: true,
    funasr_model_configured: true,
    funasr_ready: true,
    transcription_mode: "funasr",
    ...partial,
  };
}

describe("buildAsrCatalogPresentation", () => {
  it("uses D4 cached for selected SKU progress, not global D5 alone", () => {
    const selected =
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";
    const presentation = buildAsrCatalogPresentation({
      asrCaps: caps({
        funasr_model_id: "other/legacy-sidecar-model",
        funasr_required_models_cached: true,
      }),
      catalogStatus: [
        {
          catalogId: "paraformer",
          hubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
          label: "Paraformer",
          description: "",
          diskHint: "",
          recommendLongAudio: false,
          cached: false,
          active: false,
          readyForTranscribe: false,
        },
      ],
      selectedHubModelId: selected,
    });

    expect(presentation.modelsCached).toBe(false);
    expect(presentation.progress).toBe(0);
    expect(presentation.progressLabel).toBe("未下载");
  });

  it("reports D1≠D2 when sidecar hub differs from selection", () => {
    const selected =
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";
    const presentation = buildAsrCatalogPresentation({
      asrCaps: caps({
        funasr_model_id: "other/legacy-sidecar-model",
      }),
      catalogStatus: null,
      selectedHubModelId: selected,
    });

    expect(presentation.sidecarMatchesSelection).toBe(false);
    expect(presentation.selectedPrepare.sidecarMatchesSelection).toBe(false);
  });

  it("shows 100% only when selected SKU is fully cached", () => {
    const selected = DEFAULT_LOCAL_ASR_HUB_MODEL_ID;
    const presentation = buildAsrCatalogPresentation({
      asrCaps: caps({
        funasr_model_id: selected,
        funasr_active_model_cached: true,
        funasr_required_models_cached: true,
      }),
      catalogStatus: [
        {
          catalogId: "paraformer-long-vad-punc",
          hubModelId: selected,
          label: "Paraformer",
          description: "",
          diskHint: "",
          recommendLongAudio: true,
          cached: true,
          active: true,
          readyForTranscribe: true,
        },
      ],
      selectedHubModelId: selected,
    });

    expect(presentation.modelsCached).toBe(true);
    expect(presentation.progress).toBe(100);
    expect(presentation.progressTone).toBe("success");
  });

  it("does not show 100% when only active_model is cached without required models", () => {
    const selected = DEFAULT_LOCAL_ASR_HUB_MODEL_ID;
    const presentation = buildAsrCatalogPresentation({
      asrCaps: caps({
        funasr_model_id: selected,
        funasr_active_model_cached: true,
        funasr_required_models_cached: false,
      }),
      catalogStatus: null,
      selectedHubModelId: selected,
    });

    expect(presentation.modelsCached).toBe(false);
    expect(presentation.modelsReady).toBe(false);
    expect(presentation.progress).toBe(0);
    expect(presentation.progressLabel).toBe("主模型已缓存 · 辅助模型待补齐");
    expect(presentation.progressTone).toBe("muted");
  });

  it("shows cancelling label while prepare cancel is in flight", () => {
    const presentation = buildAsrCatalogPresentation({
      asrCaps: caps({ funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID }),
      catalogStatus: null,
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      prepareModelBusy: true,
      prepareModelCancelling: true,
      prepareModelProgress: 42,
    });

    expect(presentation.progress).toBe(42);
    expect(presentation.progressLabel).toBe("正在取消… 42%");
  });

  it("shows paused label after partial download was cancelled", () => {
    const presentation = buildAsrCatalogPresentation({
      asrCaps: caps({ funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID }),
      catalogStatus: null,
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      prepareModelProgress: 38,
    });

    expect(presentation.progress).toBe(38);
    expect(presentation.progressLabel).toBe("已暂停 · 38%（可续传）");
  });
});
