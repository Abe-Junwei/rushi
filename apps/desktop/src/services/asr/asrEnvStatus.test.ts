import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";

const readShellManagesBundledSidecarSync = vi.fn(() => false);

vi.mock("../shellCapabilities", () => ({
  readShellManagesBundledSidecarSync: () => readShellManagesBundledSidecarSync(),
}));

describe("buildAsrEnvPresentation", () => {
  beforeEach(() => {
    readShellManagesBundledSidecarSync.mockReturnValue(false);
    vi.resetModules();
  });

  async function build(input: Parameters<typeof import("./asrEnvStatus").buildAsrEnvPresentation>[0]) {
    const { buildAsrEnvPresentation } = await import("./asrEnvStatus");
    return buildAsrEnvPresentation(input);
  }

  it("shows ASR 就绪 chip when selected model transcribe ready", async () => {
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(p.chipLabel).toBe("ASR 就绪");
    expect(p.chipOk).toBe(true);
    expect(p.bannerTitle).toBe("本机 ASR · 可直接转写");
    expect(p.statusRows.find((r) => r.id === "transcribe")?.ok).toBe(true);
  });

  it("shows ASR 未就绪 when connected but model not ready", async () => {
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: "other/model",
        ready_for_transcribe: false,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(p.chipLabel).toBe("ASR 未就绪");
    expect(p.chipOk).toBe(false);
    expect(p.connectedGuidance).toContain("应用并重启侧车");
    expect(p.blockReason).toContain("不一致");
  });

  it("shows ASR 未就绪 when async sidecar route missing despite model ready", async () => {
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: true,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      sidecarAsyncTranscribeCapable: false,
    });
    expect(p.chipOk).toBe(false);
    expect(p.tone).toBe("warn");
    expect(p.bannerTitle).toBe("本机 ASR · 已连接");
    expect(p.statusRows.find((r) => r.id === "transcribe")?.text).toBe("侧车需升级");
    expect(p.blockReason).toContain("async 转写");
    expect(p.blockReason).toContain("重建内置侧车");
  });

  it("uses packaged copy when async sidecar route missing in release app", async () => {
    readShellManagesBundledSidecarSync.mockReturnValue(true);
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: true,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      sidecarAsyncTranscribeCapable: false,
    });
    expect(p.blockReason).toContain("重装应用");
    expect(p.blockReason).not.toContain("npm run");
  });

  it("uses packaged ffmpeg warning without npm/dev hints", async () => {
    readShellManagesBundledSidecarSync.mockReturnValue(true);
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: false,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: false,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(p.ffmpegWarning).toContain("FFmpeg");
    expect(p.ffmpegWarning).toContain("一键准备");
    expect(p.ffmpegWarning).toContain("重装应用");
    expect(p.ffmpegWarning).not.toContain("PATH");
    expect(p.blockReason).toContain("一键准备");
    expect(p.bannerDetail).toContain("一键准备");
  });

  it("uses dev ffmpeg guidance with PATH and rebuild hints", async () => {
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: false,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: false,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    expect(p.ffmpegWarning).toContain("PATH");
    expect(p.blockReason).toContain("PATH");
    expect(p.bannerDetail).toContain("PATH");
  });

  it("shows bundled copy banner while model seed is in flight", async () => {
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: true,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      prepareModelBusy: true,
      prepareModelProgress: 87,
    });
    expect(p.bannerTitle).toBe("本机 ASR · 正在准备内置模型");
    expect(p.bannerDetail).toContain("87%");
    expect(p.bannerDetail).toContain("无需联网");
    expect(p.bannerDetail).not.toContain("可直接转写");
    expect(p.chipOk).toBe(false);
    expect(p.blockReason).toContain("复制");
    expect(p.statusRows.find((r) => r.id === "transcribe")?.text).toBe("准备中");
  });

  it("shows user-facing inference queue depth", async () => {
    const p = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
        transcription_mode: "funasr",
        inference_queue_pending: 3,
        inference_queue_running: 1,
        inference_max_workers: 1,
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });

    expect(p.statusRows.find((r) => r.id === "inference_queue")?.text).toBe(
      "前方 2 个任务排队 · 正在推理 1 个任务",
    );
  });

  it("shows runtime install busy rows as 安装中", async () => {
    const base = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: false,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: false,
        transcription_mode: "stub",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
    });
    const { runtimeInstallBusyPresentation } = await import("./asrEnvStatus");
    const p = runtimeInstallBusyPresentation(base);
    expect(p.bannerTitle).toBe("本机 ASR · 正在安装运行时");
    expect(p.statusRows.find((r) => r.id === "runtime")?.text).toBe("安装中");
    expect(p.statusRows.find((r) => r.id === "transcribe")?.text).toBe("等待运行时");
  });

  it("aligns top bar and banner for error state", async () => {
    const p = await build({
      asrHealth: "error",
      asrHealthDetail: "无法连接 127.0.0.1:8741",
      asrCaps: null,
    });
    expect(p.chipLabel).toBe("ASR 未连接");
    expect(p.bannerTitle).toBe("本机 ASR · 环境异常");
    expect(p.bannerDetail).toContain("127.0.0.1:8741");
    expect(p.blockReason).toContain("未就绪");
  });

  it("shows D8 model_memory row only when weights are loaded in RAM", async () => {
    const loaded = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_loaded_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        ready_for_transcribe: true,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      modelMemoryState: "loaded",
    });
    expect(loaded.statusRows.find((r) => r.id === "model_memory")?.text).toBe("已加载 · 占 RAM");

    const disk = await build({
      asrHealth: "ok",
      asrHealthDetail: "",
      asrCaps: {
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_ready: true,
        funasr_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        funasr_loaded_model_id: null,
        funasr_required_models_cached: true,
        ready_for_transcribe: true,
        selected_model_ready: false,
        transcription_mode: "funasr",
      },
      selectedHubModelId: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
      modelMemoryState: "disk",
    });
    expect(disk.chipOk).toBe(true);
    expect(disk.statusRows.find((r) => r.id === "model_memory")).toBeUndefined();
  });
});
