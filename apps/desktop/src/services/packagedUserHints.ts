import { isPackagedDesktopApp } from "../config/env";

/** Release .app vs dev: pick user-facing guidance without npm/terminal steps. */
export function packagedOrDev(dev: string, packaged: string): string {
  return isPackagedDesktopApp() ? packaged : dev;
}

export const SIDEcarRestartFailedPackaged =
  "侧车重启失败。请在「环境与 ASR」点「重试内置侧车」或「一键准备本机 ASR」；仍失败请完全退出应用后重新打开。";

export const SIDEcarRestartFailedDev =
  "侧车重启失败。可查看 /tmp/rushi-asr-dev.log 或重新运行 npm run desktop:dev。";

export const sidecarNotListeningPackaged =
  "请在「环境与 ASR」完成「一键准备本机 ASR」或点「重试内置侧车」。";

export const sidecarNotListeningDev =
  "请运行 npm run desktop:dev 或 npm run asr:dev 启动本机侧车。";

export const modelsPathMismatchPackaged =
  "磁盘上已有模型，但当前侧车未指向应用缓存目录。请点「一键准备本机 ASR」或「重试内置侧车」，再点「刷新状态」。";

export const modelsPathMismatchDev =
  "磁盘上已有模型，但当前侧车未指向应用缓存目录。请重新运行 npm run desktop:dev 或 npm run asr:dev，再点「刷新状态」。";
