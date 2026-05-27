import { useCallback, useEffect, useRef, useState } from "react";
import { asrBaseUrl } from "../config/env";
import type { AsrHealthCapabilities } from "../tauri/projectApi";
import {
  describePrepareModelFailure,
  type PrepareModelFailureCopy,
} from "./prepareModelDownloadCopy";

export interface PrepareModelApi {
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  funasrInstallMessage: string;
  prepareDefaultFunasrModel: () => Promise<void>;
  setPrepareModelFailure: (v: PrepareModelFailureCopy | null) => void;
  setFunasrInstallMessage: (v: string) => void;
}

export function usePrepareModelController(
  refreshAsrHealth: () => Promise<void>,
  _unusedAsrCaps: AsrHealthCapabilities | null,
): PrepareModelApi {
  void _unusedAsrCaps;
  const [funasrInstallMessage, setFunasrInstallMessage] = useState<string>("");
  const [prepareModelBusy, setPrepareModelBusy] = useState(false);
  const [prepareModelProgress, setPrepareModelProgress] = useState(0);
  const [prepareModelFailure, setPrepareModelFailure] = useState<PrepareModelFailureCopy | null>(null);

  const prepareModelAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      prepareModelAbortRef.current?.abort();
    };
  }, []);

  const prepareDefaultFunasrModel = useCallback(async () => {
    prepareModelAbortRef.current?.abort();
    const ac = new AbortController();
    prepareModelAbortRef.current = ac;
    const base = asrBaseUrl().replace(/\/+$/, "");
    const urlAsync = `${base}/v1/models/prepare-default/async`;
    const urlStatus = `${base}/v1/models/prepare-status`;
    const deadlineMs = 900_000;
    setPrepareModelBusy(true);
    setPrepareModelFailure(null);
    setPrepareModelProgress(6);
    setFunasrInstallMessage("");
    const runT0 = Date.now();
    const deadline = runT0 + deadlineMs;
    const formatWait = () => {
      const secs = Math.floor((Date.now() - runT0) / 1000);
      const mm = Math.floor(secs / 60);
      const ss = secs % 60;
      return `${mm}:${ss.toString().padStart(2, "0")}`;
    };
    const bumpProgress = () => {
      const elapsed = Date.now() - runT0;
      setPrepareModelProgress(Math.min(92, 6 + Math.floor((elapsed / deadlineMs) * 86)));
    };
    try {
      const start = await fetch(urlAsync, { method: "POST", signal: ac.signal });
      const sj = (await start.json().catch(() => ({}))) as Record<string, unknown>;
      if (!start.ok) {
        const d = sj.detail;
        const code =
          typeof d === "string"
            ? d
            : start.status === 507
              ? "model_prepare_disk_full"
              : `http_${start.status}`;
        setPrepareModelFailure(describePrepareModelFailure(code));
        return;
      }
      if (sj.started !== true && sj.reason === "already_running") {
        setFunasrInstallMessage("已有模型下载任务在进行，正在同步进度…");
      }
      while (Date.now() < deadline) {
        if (ac.signal.aborted) return;
        bumpProgress();
        const stRes = await fetch(urlStatus, { signal: ac.signal });
        const st = (await stRes.json().catch(() => ({}))) as Record<string, unknown>;
        const phase = typeof st.phase === "string" ? st.phase : "?";
        const message = typeof st.message === "string" ? st.message : "";
        if (phase === "running") {
          const stage =
            message === "downloading_vad"
              ? "正在下载必需辅助模型（VAD）…"
              : "正在下载默认主模型（SenseVoiceSmall）…";
          setFunasrInstallMessage(`${stage} 已等待 ${formatWait()}。请保持联网，尽量不要关闭运行 ASR 的终端。`);
        } else if (phase === "idle") {
          if (Date.now() - runT0 < 4000) {
            setFunasrInstallMessage("正在启动后台下载任务，请稍候…");
          } else {
            setFunasrInstallMessage("模型准备状态仍为 idle：请重启 ASR（python -m rushi_asr）后再试。");
          }
        } else if (phase === "?") {
          setFunasrInstallMessage("无法读取模型准备状态，请确认 rushi-asr 已升级后重试。");
        }
        if (phase === "done") {
          setPrepareModelProgress(100);
          const result = st.result as Record<string, unknown> | null | undefined;
          const warns = Array.isArray(result?.warnings)
            ? (result?.warnings as string[]).join("；")
            : "";
          setFunasrInstallMessage(
            [
              "默认模型与必需辅助模型已准备（或已在缓存中）。",
              warns ? `提示：${warns}` : "",
              typeof result?.path === "string" ? `缓存路径：${result.path}` : "",
              typeof result?.vad_path === "string" ? `辅助模型路径：${result.vad_path}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          );
          await refreshAsrHealth();
          return;
        }
        if (phase === "error") {
          setFunasrInstallMessage("");
          const code = typeof st.error_code === "string" ? st.error_code : "unknown";
          setPrepareModelFailure(describePrepareModelFailure(code));
          return;
        }
        await new Promise<void>((r, rej) => {
          const t = setTimeout(r, 1000);
          ac.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(t);
              rej(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      }
      setFunasrInstallMessage("");
      setPrepareModelFailure(describePrepareModelFailure("client_timeout"));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFunasrInstallMessage("");
      setPrepareModelFailure(describePrepareModelFailure("fetch_failed"));
    } finally {
      setPrepareModelBusy(false);
      setPrepareModelProgress(0);
    }
  }, [refreshAsrHealth]);

  return {
    prepareModelBusy,
    prepareModelProgress,
    prepareModelFailure,
    funasrInstallMessage,
    prepareDefaultFunasrModel,
    setPrepareModelFailure,
    setFunasrInstallMessage,
  };
}
