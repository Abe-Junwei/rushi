import { isPackagedDesktopApp } from "../config/env";

/** Release .app vs dev: pick user-facing guidance without npm/terminal steps. */
export function packagedOrDev(dev: string, packaged: string): string {
  return isPackagedDesktopApp() ? packaged : dev;
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
