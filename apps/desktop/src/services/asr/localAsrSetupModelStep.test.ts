import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyHubModelToSidecar,
  syncBundledSidecarToPreferredHub,
} from "./localAsrSetupModelStep";

const getLocalAsrHubModelPref = vi.fn<() => Promise<string | null>>();
const setLocalAsrHubModelPref = vi.fn<
  (hub: string, options?: { restartSidecar?: boolean }) => Promise<void>
>();
const getLocalAsrRecognitionLanguagePref = vi.fn<() => Promise<string>>();
const setLocalAsrRecognitionLanguagePref = vi.fn<
  (language: string, options?: { restartSidecar?: boolean }) => Promise<void>
>();
const retryBundledAsrSidecar = vi.fn<() => Promise<void>>();
const fetchAsrHealthCaps = vi.fn<
  () => Promise<{
    funasr_ready?: boolean;
    ready_for_transcribe?: boolean;
    funasr_model_id?: string | null;
    funasr_language?: string | null;
    funasr_required_models_cached?: boolean;
    funasr_active_model_cached?: boolean;
    funasr_default_model_cached?: boolean;
    funasr_vad_model_cached?: boolean;
  } | null>
>();
const pollLoopbackHealthUntil = vi.fn<
  () => Promise<{
    funasr_ready?: boolean;
    ready_for_transcribe?: boolean;
    selected_model_ready?: boolean;
    funasr_model_id?: string | null;
    funasr_language?: string | null;
    funasr_required_models_cached?: boolean;
    funasr_active_model_cached?: boolean;
    funasr_default_model_cached?: boolean;
    funasr_vad_model_cached?: boolean;
  } | null>
>();

vi.mock("../../config/env", () => ({
  isDefaultBundledAsrTarget: () => true,
}));

const asrAppManagesBundledSidecar = vi.fn<() => Promise<boolean>>();
const killLoopbackAsrListeners = vi.fn<() => Promise<void>>();

vi.mock("../../tauri/projectApi", () => ({
  getLocalAsrHubModelPref: () => getLocalAsrHubModelPref(),
  setLocalAsrHubModelPref: (hub: string, options?: { restartSidecar?: boolean }) =>
    setLocalAsrHubModelPref(hub, options),
  getLocalAsrRecognitionLanguagePref: () => getLocalAsrRecognitionLanguagePref(),
  setLocalAsrRecognitionLanguagePref: (
    language: string,
    options?: { restartSidecar?: boolean },
  ) => setLocalAsrRecognitionLanguagePref(language, options),
  retryBundledAsrSidecar: () => retryBundledAsrSidecar(),
  asrAppManagesBundledSidecar: () => asrAppManagesBundledSidecar(),
  killLoopbackAsrListeners: () => killLoopbackAsrListeners(),
}));

vi.mock("./asrHealthSnapshot", () => ({
  fetchAsrHealthCaps: () => fetchAsrHealthCaps(),
  pollLoopbackHealthUntil: () => pollLoopbackHealthUntil(),
}));

const selection = {
  selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
  catalogStatus: null,
  recognitionLanguage: "zh" as const,
};

const readyCaps = {
  funasr_ready: true,
  ready_for_transcribe: true,
  funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
  funasr_language: "zh",
  funasr_required_models_cached: true,
  funasr_active_model_cached: true,
  funasr_default_model_cached: true,
  funasr_vad_model_cached: true,
};

describe("syncBundledSidecarToPreferredHub", () => {
  beforeEach(() => {
    getLocalAsrHubModelPref.mockReset();
    setLocalAsrHubModelPref.mockReset();
    getLocalAsrRecognitionLanguagePref.mockReset();
    setLocalAsrRecognitionLanguagePref.mockReset();
    retryBundledAsrSidecar.mockReset();
    fetchAsrHealthCaps.mockReset();
    retryBundledAsrSidecar.mockResolvedValue(undefined);
    setLocalAsrHubModelPref.mockResolvedValue(undefined);
    setLocalAsrRecognitionLanguagePref.mockResolvedValue(undefined);
    getLocalAsrHubModelPref.mockResolvedValue("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch");
    getLocalAsrRecognitionLanguagePref.mockResolvedValue("zh");
    setLocalAsrHubModelPref.mockResolvedValue(undefined);
    setLocalAsrRecognitionLanguagePref.mockResolvedValue(undefined);
  });

  it("skips restart when loopback /health already matches UI selection", async () => {
    fetchAsrHealthCaps.mockResolvedValue(readyCaps);

    const restarted = await syncBundledSidecarToPreferredHub(selection);

    expect(restarted).toBe(false);
    expect(retryBundledAsrSidecar).not.toHaveBeenCalled();
    expect(setLocalAsrHubModelPref).toHaveBeenCalledWith("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch", {
      restartSidecar: false,
    });
  });
});

describe("applyHubModelToSidecar", () => {
  beforeEach(() => {
    getLocalAsrHubModelPref.mockReset();
    setLocalAsrHubModelPref.mockReset();
    getLocalAsrRecognitionLanguagePref.mockReset();
    setLocalAsrRecognitionLanguagePref.mockReset();
    retryBundledAsrSidecar.mockReset();
    asrAppManagesBundledSidecar.mockReset();
    killLoopbackAsrListeners.mockReset();
    fetchAsrHealthCaps.mockReset();
    pollLoopbackHealthUntil.mockReset();
    asrAppManagesBundledSidecar.mockResolvedValue(true);
    killLoopbackAsrListeners.mockResolvedValue(undefined);
    getLocalAsrHubModelPref.mockResolvedValue("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch");
    getLocalAsrRecognitionLanguagePref.mockResolvedValue("zh");
    setLocalAsrHubModelPref.mockResolvedValue(undefined);
    setLocalAsrRecognitionLanguagePref.mockResolvedValue(undefined);
    retryBundledAsrSidecar.mockResolvedValue(undefined);
  });

  it("writes prefs, restarts bundled sidecar, and waits for loopback config", async () => {
    fetchAsrHealthCaps.mockResolvedValue({
      ...readyCaps,
      funasr_model_id: "iic/other",
    });
    pollLoopbackHealthUntil.mockResolvedValue({
      funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      funasr_language: "zh",
    });

    const result = await applyHubModelToSidecar(selection);

    expect(result.ok).toBe(true);
    expect(setLocalAsrRecognitionLanguagePref).toHaveBeenCalledWith("zh", {
      restartSidecar: false,
    });
    expect(setLocalAsrHubModelPref).toHaveBeenCalledWith("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch", {
      restartSidecar: false,
    });
    expect(retryBundledAsrSidecar).toHaveBeenCalled();
    expect(pollLoopbackHealthUntil).toHaveBeenCalled();
  });

  it("restarts source sidecar and waits when bundled is not managed", async () => {
    asrAppManagesBundledSidecar.mockResolvedValue(false);
    fetchAsrHealthCaps.mockResolvedValue({
      ...readyCaps,
      funasr_model_id: "iic/other",
    });
    pollLoopbackHealthUntil.mockResolvedValue({
      funasr_model_id:
        "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      funasr_language: "zh",
    });

    const result = await applyHubModelToSidecar({
      ...selection,
      selectedHubModelId:
        "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    });

    expect(result.ok).toBe(true);
    expect(retryBundledAsrSidecar).toHaveBeenCalled();
    expect(pollLoopbackHealthUntil).toHaveBeenCalled();
  });

  it("does not claim transcribe-ready when hub matches but model is not cached", async () => {
    fetchAsrHealthCaps.mockResolvedValue({
      ...readyCaps,
      ready_for_transcribe: false,
      funasr_required_models_cached: false,
      funasr_active_model_cached: false,
      funasr_default_model_cached: false,
      funasr_model_id: "iic/other",
    });
    pollLoopbackHealthUntil.mockResolvedValue({
      funasr_model_id:
        "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      funasr_language: "zh",
      ready_for_transcribe: false,
      funasr_required_models_cached: false,
      funasr_active_model_cached: false,
      funasr_default_model_cached: false,
    });

    const result = await applyHubModelToSidecar(selection);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transcribeReady).toBe(false);
      expect(result.message).toContain("下载当前模型");
      expect(result.message).not.toContain("可以开始转写");
    }
  });
});
