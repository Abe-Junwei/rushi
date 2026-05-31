import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import { normalizeLocalAsrRecognitionLanguage } from "./localAsrRecognitionLanguage";

export function parseAsrHealthJson(data: unknown): AsrHealthCapabilities | null {
  if (!data || typeof data !== "object") return null;
  const j = data as Record<string, unknown>;
  if (typeof j.status !== "string" || j.status !== "ok") return null;
  if (j.service !== "rushi-asr") return null;
  const mode = j.transcription_mode === "funasr" ? "funasr" : "stub";
  return {
    ffmpeg_ok: j.ffmpeg_ok === true,
    funasr_import_ok: j.funasr_import_ok === true,
    funasr_model_configured: j.funasr_model_configured === true,
    funasr_model_explicit_from_env: j.funasr_model_explicit_from_env === true,
    funasr_default_model_cached: j.funasr_default_model_cached === true,
    funasr_active_model_cached: j.funasr_active_model_cached === true,
    funasr_vad_model_cached: j.funasr_vad_model_cached === true,
    funasr_punc_model_cached:
      typeof j.funasr_punc_model_cached === "boolean" ? j.funasr_punc_model_cached : undefined,
    funasr_required_models_cached: j.funasr_required_models_cached === true,
    funasr_ready: j.funasr_ready === true,
    ready_for_transcribe: j.ready_for_transcribe === true,
    transcription_mode: mode,
    funasr_model_id: typeof j.funasr_model_id === "string" ? j.funasr_model_id : null,
    funasr_language:
      typeof j.funasr_language === "string"
        ? normalizeLocalAsrRecognitionLanguage(j.funasr_language)
        : null,
    funasr_loaded_model_id:
      typeof j.funasr_loaded_model_id === "string" ? j.funasr_loaded_model_id : null,
    funasr_punc_model_id:
      typeof j.funasr_punc_model_id === "string" ? j.funasr_punc_model_id : null,
    rushi_models_root: typeof j.rushi_models_root === "string" ? j.rushi_models_root : null,
  };
}

export function funasrManualSetupCommands(): string {
  return [
    "# 推荐：与桌面共用模型缓存目录",
    "npm run asr:dev",
    "",
    "# 或手动（须设置 RUSHI_MODELS_ROOT，见环境页「桌面模型目录」）",
    "cd services/asr",
    "source .venv/bin/activate   # Windows: .venv\\Scripts\\activate",
    'pip install -e ".[funasr]"',
    "export RUSHI_MODELS_ROOT=\"<桌面模型目录>\"",
    "export MODELSCOPE_CACHE=\"$RUSHI_MODELS_ROOT/modelscope\"",
    "python -m rushi_asr",
  ].join("\n");
}
