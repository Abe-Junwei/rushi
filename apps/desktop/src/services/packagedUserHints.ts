import { readShellManagesBundledSidecarSync } from "./shellCapabilities";

/**
 * Shell-managed bundled sidecar vs source/venv sidecar user guidance.
 * Uses Rust `asr_app_manages_bundled_sidecar` — not `import.meta.env.PROD`.
 */
export function packagedOrDev(dev: string, managed: string): string {
  return readShellManagesBundledSidecarSync() ? managed : dev;
}

export function packagedOrDevArray<T>(dev: T, managed: T): T {
  return readShellManagesBundledSidecarSync() ? managed : dev;
}

export const SIDEcarRestartFailedPackaged =
  "侧车重启失败。请在「环境 → 本机 ASR」点「重试内置侧车」或「一键准备本机 ASR」；仍失败请完全退出应用后重新打开。";

export const SIDEcarRestartFailedDev =
  "侧车重启失败。可查看 /tmp/rushi-asr-dev.log 或重新运行 npm run desktop:dev。";

export const modelsPathMismatchPackaged =
  "磁盘上已有模型，但当前侧车未指向应用缓存目录。请点「一键准备本机 ASR」或「重试内置侧车」，再点「刷新状态」。";

export const modelsPathMismatchDev =
  "磁盘上已有模型，但当前侧车未指向应用缓存目录。请重新运行 npm run desktop:dev 或 npm run asr:dev，再点「刷新状态」。";

/** FFmpeg 随侧车分发；缺失时修复 runtime，而非单独安装 FFmpeg。 */
export const ffmpegMissingPackaged =
  "未检测到 FFmpeg。FFmpeg 随侧车一并分发——请点「一键准备本机 ASR」修复侧车；仍失败请重装应用。";

export const ffmpegMissingDev =
  "未检测到 FFmpeg。请安装 ffmpeg/ffprobe 并加入 PATH，或重建内置侧车（npm run asr:build-sidecar-unix）后重启 ASR。";

export const ffmpegBannerDetailPackaged =
  "侧车已连接，但未检测到 FFmpeg。请点「一键准备」下载或修复侧车运行时。";

export const ffmpegBannerDetailDev =
  "侧车已连接，但未检测到 FFmpeg。请安装 ffmpeg/ffprobe 并加入 PATH 后重启侧车。";

export const ffmpegBlockReasonPackaged =
  "未检测到 FFmpeg：请在「环境 → 本机 ASR」点「一键准备本机 ASR」修复侧车；仍失败请重装应用。";

export const ffmpegBlockReasonDev =
  "未检测到 FFmpeg：请安装 ffmpeg/ffprobe 并加入 PATH，或重建内置侧车后重启 ASR。";

export const sidecarAsyncTranscribeBlockReasonManaged =
  "侧车版本过旧。请在「环境 → 本机 ASR」应用并重启侧车或一键准备；仍失败请重装应用。";

export const sidecarAsyncTranscribeBlockReasonDev =
  "侧车版本过旧（缺少 async 转写）。请在环境页应用并重启侧车，或重建内置侧车。";

export const sidecarMissingHealthBlockReasonManaged =
  "未检测到可用侧车。请在「环境 → 本机 ASR」完成「一键准备本机 ASR」，或通过「下载 / 修复语音识别组件」安装应用数据侧车。";

export const sidecarMissingHealthBlockReasonDev =
  "未检测到可用侧车（dev 需先 npm run asr:build-sidecar-unix），或先通过「下载 / 修复语音识别组件」安装应用数据侧车。";

export const prepareModelFunasrMissingTipsManaged = [
  "请在「环境 → 本机 ASR」点「一键准备本机 ASR」或「重试内置侧车」。",
  "若模型未就绪，请完全退出应用后重新打开（会重新从安装包复制内置模型）。",
];

export const prepareModelFunasrMissingTipsDev = [
  '在 services/asr 的 venv 中执行 pip install -e ".[funasr]"，然后重启 python -m rushi_asr。',
  "也可用本页「一键安装 FunASR 依赖」后重启 ASR，再点「下载当前模型」。",
];

export const prepareModelScopeMissingTipsManaged = [
  "Release 包不应走 ModelScope 下载；请完全退出应用后重新打开以重新复制内置模型。",
  "若仍出现此错误，请点「清除模型缓存」后重启，或重装最新版本。",
];

export const prepareModelScopeMissingTipsDev = [
  "在同一 venv 中安装 funasr 扩展依赖（通常已包含 modelscope）；重启 ASR 后再试。",
];

export const loopbackInvokeMissingCommandManaged =
  "请完全退出应用后重新打开；若仍出现此错误，请重新安装最新版本。";

export const loopbackInvokeMissingCommandDev =
  "请完全退出应用并重新运行 npm run desktop:dev 以加载最新 Tauri 命令。";

export const asrStatusFfmpegActionLabelManaged = "一键准备";
export const asrStatusFfmpegActionLabelDev = "修复侧车";

export const bundledModelsMissingTipsManaged = [
  "请确认使用 v0.1.8 Release DMG / Windows 安装包装载，且安装包体积约 1.4 GB。",
  "若仍出现此错误，请完全退出应用后重新打开，或重新安装最新版本。",
];

export const bundledModelsMissingTipsDev = [
  "请确认使用 v0.1.8 Release DMG 安装，且安装包体积约 1.4 GB。",
  "开发构建需先运行 npm run asr:stage-bundled-models。",
];
