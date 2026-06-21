import { describe, expect, it, vi, beforeEach } from "vitest";
import * as projectApi from "../../tauri/projectApi";
import { pollLoopbackHealthUntil } from "./asrHealthSnapshot";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";
import {
  OFFLINE_IMPORT_CANCELLED_MESSAGE,
  offlineAsrModelsPackAssetName,
  offlineAsrModelsPackDownloadUrl,
  runOfflineAsrModelsPackImportFlow,
} from "./offlineAsrModelsPackFlow";

vi.mock("../../tauri/projectApi", () => ({
  pickAndImportOfflineAsrModelsPack: vi.fn(),
}));

vi.mock("./asrHealthSnapshot", () => ({
  fetchAsrHealthCaps: vi.fn(),
  pollLoopbackHealthUntil: vi.fn(),
}));

vi.mock("./offlineAsrModelsPackProgress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./offlineAsrModelsPackProgress")>();
  return {
    ...actual,
    listenOfflineAsrModelsPackProgress: vi.fn(async () => () => {}),
  };
});

describe("offlineAsrModelsPackFlow", () => {
  beforeEach(() => {
    vi.mocked(projectApi.pickAndImportOfflineAsrModelsPack).mockReset();
    vi.mocked(pollLoopbackHealthUntil).mockReset();
  });

  const baseInput = {
    selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    catalogStatus: null,
    prepareModelBusy: false,
    prepareModelCancelling: false,
    onProgressMessage: vi.fn(),
    onImportProgress: vi.fn(),
    onClearProgress: vi.fn(),
    refreshAsrRuntimeInfo: vi.fn(async () => {}),
    refreshAsrModelCacheInfo: vi.fn(async () => {}),
    retryBundledAsrSidecar: vi.fn(async () => {}),
  };

  it("builds release asset name and download url", () => {
    expect(offlineAsrModelsPackAssetName("0.1.8")).toBe("rushi-offline-asr-models_0.1.8.zip");
    expect(offlineAsrModelsPackDownloadUrl("v0.1.8")).toBe(
      "https://github.com/Abe-Junwei/rushi/releases/download/v0.1.8/rushi-offline-asr-models_0.1.8.zip",
    );
  });

  it("blocks import while model download is running", async () => {
    const result = await runOfflineAsrModelsPackImportFlow({
      ...baseInput,
      prepareModelBusy: true,
    });
    expect(result.kind).toBe("blocked");
  });

  it("short-circuits when pack already seeded", async () => {
    vi.mocked(projectApi.pickAndImportOfflineAsrModelsPack).mockResolvedValue({
      imported_bytes: 0,
      models_root: "/tmp/models",
      modelscope_cache: "/tmp/models/modelscope",
      pack_version: 1,
      bundle_id: "default-paraformer-v1",
      seeded_at: "2026-06-21T00:00:00+08:00",
      skipped_reseed: true,
    });

    const result = await runOfflineAsrModelsPackImportFlow(baseInput);
    expect(result).toEqual({ kind: "success", skippedReseed: true });
    expect(pollLoopbackHealthUntil).not.toHaveBeenCalled();
  });

  it("succeeds when polled health reports required models cached", async () => {
    vi.mocked(projectApi.pickAndImportOfflineAsrModelsPack).mockResolvedValue({
      imported_bytes: 100,
      models_root: "/tmp/models",
      modelscope_cache: "/tmp/models/modelscope",
      pack_version: 1,
      bundle_id: "default-paraformer-v1",
      seeded_at: "2026-06-21T00:00:00+08:00",
    });
    vi.mocked(pollLoopbackHealthUntil).mockResolvedValue({
      ffmpeg_ok: true,
      funasr_import_ok: true,
      funasr_model_configured: true,
      funasr_ready: true,
      funasr_required_models_cached: true,
      selected_model_ready: true,
      transcription_mode: "funasr",
      funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });

    const result = await runOfflineAsrModelsPackImportFlow(baseInput);
    expect(result.kind).toBe("success");
    expect(pollLoopbackHealthUntil).toHaveBeenCalled();
  });

  it("returns cancelled when rust import reports cancellation", async () => {
    vi.mocked(projectApi.pickAndImportOfflineAsrModelsPack).mockRejectedValue(
      new Error(OFFLINE_IMPORT_CANCELLED_MESSAGE),
    );

    const result = await runOfflineAsrModelsPackImportFlow(baseInput);
    expect(result).toEqual({ kind: "cancelled" });
  });

  it("returns error when health poll times out", async () => {
    vi.mocked(projectApi.pickAndImportOfflineAsrModelsPack).mockResolvedValue({
      imported_bytes: 100,
      models_root: "/tmp/models",
      modelscope_cache: "/tmp/models/modelscope",
      pack_version: 1,
      bundle_id: "default-paraformer-v1",
      seeded_at: "2026-06-21T00:00:00+08:00",
    });
    vi.mocked(pollLoopbackHealthUntil).mockResolvedValue(null);

    const result = await runOfflineAsrModelsPackImportFlow(baseInput);
    expect(result.kind).toBe("error");
  });
});
