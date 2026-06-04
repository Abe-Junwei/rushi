import { describe, expect, it } from "vitest";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";
import { buildAsrEnvPresentation } from "./asrEnvStatus";

describe("buildAsrEnvPresentation", () => {
  it("shows ASR 就绪 chip when selected model transcribe ready", () => {
    const p = buildAsrEnvPresentation({
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
    });
    expect(p.chipLabel).toBe("ASR 就绪");
    expect(p.chipOk).toBe(true);
    expect(p.bannerTitle).toBe("本机 ASR · 可直接转写");
    expect(p.statusRows.find((r) => r.id === "transcribe")?.ok).toBe(true);
  });

  it("shows ASR 未就绪 when connected but model not ready", () => {
    const p = buildAsrEnvPresentation({
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

  it("shows ASR 未就绪 when async sidecar route missing despite model ready", () => {
    const p = buildAsrEnvPresentation({
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
    expect(p.blockReason).toContain("transcribe/async");
  });

  it("aligns top bar and banner for error state", () => {
    const p = buildAsrEnvPresentation({
      asrHealth: "error",
      asrHealthDetail: "无法连接 127.0.0.1:8741",
      asrCaps: null,
    });
    expect(p.chipLabel).toBe("ASR 未连接");
    expect(p.bannerTitle).toBe("本机 ASR · 环境异常");
    expect(p.bannerDetail).toContain("127.0.0.1:8741");
    expect(p.blockReason).toContain("未就绪");
  });
});
