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
  () => Promise<{ funasr_ready?: boolean; funasr_model_id?: string | null } | null>
>();

vi.mock("../../config/env", () => ({
  isDefaultBundledAsrTarget: () => true,
}));

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
}));

vi.mock("./asrHealthSnapshot", () => ({
  fetchAsrHealthCaps: () => fetchAsrHealthCaps(),
  pollLoopbackHealthUntil: () => pollLoopbackHealthUntil(),
}));

const selection = {
  selectedHubModelId: "iic/SenseVoiceSmall",
  catalogStatus: null,
  recognitionLanguage: "zh" as const,
};

const readyCaps = {
  funasr_ready: true,
  ready_for_transcribe: true,
  funasr_model_id: "iic/SenseVoiceSmall",
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
    fetchAsrHealthCaps.mockReset();
    getLocalAsrHubModelPref.mockResolvedValue("iic/SenseVoiceSmall");
    getLocalAsrRecognitionLanguagePref.mockResolvedValue("zh");
    setLocalAsrHubModelPref.mockResolvedValue(undefined);
    setLocalAsrRecognitionLanguagePref.mockResolvedValue(undefined);
  });

  it("skips restart when loopback /health already matches UI selection", async () => {
    fetchAsrHealthCaps.mockResolvedValue(readyCaps);

    const restarted = await syncBundledSidecarToPreferredHub(selection);

    expect(restarted).toBe(false);
    expect(setLocalAsrHubModelPref).not.toHaveBeenCalled();
  });
});

describe("applyHubModelToSidecar", () => {
  beforeEach(() => {
    getLocalAsrHubModelPref.mockReset();
    setLocalAsrHubModelPref.mockReset();
    getLocalAsrRecognitionLanguagePref.mockReset();
    setLocalAsrRecognitionLanguagePref.mockReset();
    retryBundledAsrSidecar.mockReset();
    fetchAsrHealthCaps.mockReset();
    pollLoopbackHealthUntil.mockReset();
    getLocalAsrHubModelPref.mockResolvedValue("iic/SenseVoiceSmall");
    getLocalAsrRecognitionLanguagePref.mockResolvedValue("zh");
    setLocalAsrHubModelPref.mockResolvedValue(undefined);
    setLocalAsrRecognitionLanguagePref.mockResolvedValue(undefined);
    retryBundledAsrSidecar.mockResolvedValue(undefined);
  });

  it("waits for loopback after switching hub pref", async () => {
    getLocalAsrHubModelPref.mockResolvedValue("iic/other");
    fetchAsrHealthCaps.mockResolvedValue({
      ...readyCaps,
      funasr_model_id: "iic/other",
    });
    pollLoopbackHealthUntil.mockResolvedValue({
      funasr_ready: true,
      funasr_model_id: "iic/SenseVoiceSmall",
      funasr_language: "zh",
    });

    const result = await applyHubModelToSidecar(selection);

    expect(result.ok).toBe(true);
    expect(setLocalAsrRecognitionLanguagePref).toHaveBeenCalledWith("zh", {
      restartSidecar: false,
    });
    expect(setLocalAsrHubModelPref).toHaveBeenCalledWith("iic/SenseVoiceSmall", undefined);
    expect(retryBundledAsrSidecar).not.toHaveBeenCalled();
    expect(pollLoopbackHealthUntil).toHaveBeenCalled();
  });
});
