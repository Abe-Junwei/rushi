export type RefreshAsrRuntimeOptions = {
  /** 模型下载进行中：跳过 walk 整个 models 目录的 cache 扫描。 */
  skipModelCacheScan?: boolean;
  /** 模型下载进行中：跳过 Tauri asr_setup_diagnose（含 /health + 端口探测）。 */
  skipSetupDiagnose?: boolean;
};

/** 侧车模型下载轮询期间：仅刷新 /health，避免 UI 线程被 Tauri 诊断占满。 */
export const REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE: RefreshAsrRuntimeOptions = {
  skipModelCacheScan: true,
  skipSetupDiagnose: true,
};
