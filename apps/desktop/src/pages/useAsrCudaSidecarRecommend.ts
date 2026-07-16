import { useCallback, useEffect, useState } from "react";
import { isTauriRuntime } from "../config/env";
import {
  asrCancelCudaSidecarDownload,
  asrCudaSidecarStatus,
  asrDownloadCudaSidecar,
  isAsrCudaInstallRunning,
  type AsrCudaSidecarStatus,
} from "../tauri/asrCudaApi";

export function useAsrCudaSidecarRecommend() {
  const tauriRuntime = isTauriRuntime();
  const [status, setStatus] = useState<AsrCudaSidecarStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!tauriRuntime) {
      setStatus(null);
      return null;
    }
    try {
      const next = await asrCudaSidecarStatus();
      setStatus(next);
      return next;
    } catch {
      setStatus(null);
      return null;
    }
  }, [tauriRuntime]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const phase = status?.install.phase;
  useEffect(() => {
    if (!tauriRuntime || !isAsrCudaInstallRunning(phase)) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, 500);
    return () => window.clearInterval(timer);
  }, [phase, refresh, tauriRuntime]);

  const startDownload = useCallback(async () => {
    if (!tauriRuntime || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await asrDownloadCudaSidecar();
      if (!result.started) {
        setMessage(
          result.reason === "already_running"
            ? "GPU 组件下载已在进行中。"
            : result.reason === "platform_unsupported"
              ? "当前平台不支持 GPU 加速组件下载。"
              : result.reason === "lrc_download_running"
                ? "本机语音识别组件正在下载或修复，请稍后再下载 GPU 加速组件。"
                : "无法开始下载 GPU 加速组件。",
        );
        return;
      }
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => window.setTimeout(r, 1000));
        const next = await refresh();
        if (!isAsrCudaInstallRunning(next?.install.phase)) {
          if (next?.install.phase === "installed" || next?.cudaInstalled) {
            setMessage(
              "GPU 加速组件已安装。请点击「重启侧车」以启用加速；失败时仍可使用 CPU。",
            );
          } else if (next?.install.phase === "cancelled") {
            setMessage("已取消下载；不影响 CPU 转写。");
          } else if (next?.install.phase === "error") {
            setMessage(
              next.install.message ||
                "GPU 组件安装失败；将继续使用 CPU 转写，不影响现有功能。",
            );
          }
          break;
        }
      }
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "GPU 组件下载失败；将继续使用 CPU 转写。",
      );
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [busy, refresh, tauriRuntime]);

  const cancelDownload = useCallback(async () => {
    try {
      await asrCancelCudaSidecarDownload();
    } finally {
      await refresh();
    }
  }, [refresh]);

  return {
    status,
    busy,
    message,
    refresh,
    startDownload,
    cancelDownload,
  };
}
