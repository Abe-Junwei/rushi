import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { asrBaseUrl, asrHealthUrl, isDefaultBundledAsrTarget } from "../config/env";
import type { AsrHealthCapabilities } from "../tauri/p1Api";
import * as p1 from "../tauri/p1Api";
import {
  tryBuildP1OnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import { describePrepareModelFailure, type PrepareModelFailureCopy } from "./prepareModelDownloadCopy";

export type AsrHealthState = "checking" | "ok" | "error";

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
    funasr_ready: j.funasr_ready === true,
    transcription_mode: mode,
    funasr_model_id: typeof j.funasr_model_id === "string" ? j.funasr_model_id : null,
    rushi_models_root: typeof j.rushi_models_root === "string" ? j.rushi_models_root : null,
  };
}

export function funasrManualSetupCommands(): string {
  return [
    "cd services/asr",
    "source .venv/bin/activate   # Windows: .venv\\Scripts\\activate",
    'pip install -e ".[funasr]"',
    "# 可选：export RUSHI_FUNASR_MODEL=其他模型   # 不设则使用内置默认 iic/SenseVoiceSmall",
    "python -m rushi_asr",
  ].join("\n");
}

export interface AsrBridgeApi {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  bundledAsrDiag: p1.BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  sttOnlineBridgeReady: boolean;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  refreshAsrHealth: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  bumpSttOnlineRuntimeChanged: () => void;
}

export function useAsrBridgeController(): AsrBridgeApi {
  const [asrHealth, setAsrHealth] = useState<AsrHealthState>("checking");
  const [asrHealthDetail, setAsrHealthDetail] = useState<string>("");
  const [bundledAsrDiag, setBundledAsrDiag] = useState<p1.BundledAsrLaunchReport | null>(null);
  const [asrCaps, setAsrCaps] = useState<AsrHealthCapabilities | null>(null);
  const [funasrInstallMessage, setFunasrInstallMessage] = useState<string>("");
  const [prepareModelBusy, setPrepareModelBusy] = useState(false);
  const [prepareModelProgress, setPrepareModelProgress] = useState(0);
  const [prepareModelFailure, setPrepareModelFailure] = useState<PrepareModelFailureCopy | null>(null);
  const [sttOnlineBridgeEpoch, setSttOnlineBridgeEpoch] = useState(0);

  const prepareModelAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      prepareModelAbortRef.current?.abort();
    };
  }, []);

  const sttOnlineBridgeReady = useMemo(
    () => tryBuildP1OnlineTranscribeBridgePayload() !== null,
    [sttOnlineBridgeEpoch],
  );

  const bumpSttOnlineRuntimeChanged = useCallback(() => {
    setSttOnlineBridgeEpoch((n) => n + 1);
  }, []);

  const refreshBundledAsrDiag = useCallback(async () => {
    try {
      const r = await p1.bundledAsrLaunchReport();
      setBundledAsrDiag(r);
    } catch {
      setBundledAsrDiag(null);
    }
  }, []);

  const refreshAsrHealth = useCallback(async () => {
    setAsrHealth("checking");
    setAsrHealthDetail("");
    setAsrCaps(null);
    const url = asrHealthUrl();
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        const parsed = parseAsrHealthJson(data);
        if (!parsed) {
          setAsrHealth("error");
          setAsrHealthDetail(`无法解析 ${url} 的能力字段（响应格式不符合 rushi-asr /health 契约）。`);
          await refreshBundledAsrDiag();
          return;
        }
        setAsrCaps(parsed);
        setAsrHealth("ok");
        await refreshBundledAsrDiag();
        return;
      }
      setAsrHealth("error");
      setAsrHealthDetail(`无法访问 ${url}（HTTP ${res.status}）。请先在本机启动 ASR：见说明中「启动本地 ASR」一节。`);
    } catch (e) {
      setAsrHealth("error");
      const msg = e instanceof Error ? e.message : String(e);
      setAsrHealthDetail(`无法连接 ${url}：${msg}。请确认已在终端启动 python -m rushi_asr，且地址与 VITE_ASR_BASE_URL 一致。`);
    }
    await refreshBundledAsrDiag();
  }, [refreshBundledAsrDiag]);

  useEffect(() => {
    void refreshAsrHealth();
  }, [refreshAsrHealth]);

  const asrHealthDetailDisplay = useMemo(() => {
    if (asrHealth !== "error") return asrHealthDetail;
    if (
      isDefaultBundledAsrTarget() &&
      bundledAsrDiag?.attempted &&
      !bundledAsrDiag.success &&
      bundledAsrDiag.detail
    ) {
      return `${asrHealthDetail}\n\n【安装包内置推理侧车】\n${bundledAsrDiag.detail}`;
    }
    return asrHealthDetail;
  }, [asrHealth, asrHealthDetail, bundledAsrDiag]);

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
        if (phase === "running") {
          setFunasrInstallMessage(
            `正在从 ModelScope 拉取默认权重（内置 SenseVoiceSmall）… 已等待 ${formatWait()}。请保持联网，尽量不要关闭运行 ASR 的终端。`,
          );
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
              "默认模型权重已准备（或已在缓存中）。",
              warns ? `提示：${warns}` : "",
              typeof result?.path === "string" ? `缓存路径：${result.path}` : "",
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

  useEffect(() => {
    if (!asrCaps) return;
    if (
      asrCaps.funasr_ready &&
      !asrCaps.funasr_default_model_cached &&
      !prepareModelBusy &&
      !prepareModelFailure
    ) {
      void prepareDefaultFunasrModel();
    }
  }, [asrCaps, prepareModelBusy, prepareModelFailure, prepareDefaultFunasrModel]);

  const retryBundledAsrSidecar = useCallback(async () => {
    try {
      await p1.p1RetryBundledAsrSidecar();
      await refreshBundledAsrDiag();
      await refreshAsrHealth();
    } catch {
      /* ignore */
    }
  }, [refreshAsrHealth, refreshBundledAsrDiag]);

  const installFunasrDepsInteractive = useCallback(async () => {
    setPrepareModelFailure(null);
    setFunasrInstallMessage("");
    try {
      const log = await p1.p1InstallFunasrDepsInteractive();
      if (log != null && log.length > 0) {
        setFunasrInstallMessage(
          [
            "已在所选仓库中执行安装脚本。未设置 RUSHI_FUNASR_MODEL 时将使用内置默认模型 iic/SenseVoiceSmall（首次转写会从网络拉取权重）。",
            "停止并重新执行 python -m rushi_asr，然后回到本页点「重新检测 ASR」。",
            "",
            "--- 脚本输出（节选）---",
            log.length > 4000 ? `${log.slice(0, 4000)}…` : log,
          ].join("\n"),
        );
      }
      void refreshAsrHealth();
    } catch {
      /* ignore */
    }
  }, [refreshAsrHealth]);

  const copyFunasrManualCommands = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(funasrManualSetupCommands());
      setFunasrInstallMessage("已复制手动安装命令到剪贴板（请在终端粘贴执行）。");
    } catch {
      /* ignore */
    }
  }, []);

  return {
    asrHealth,
    asrHealthDetail: asrHealthDetailDisplay,
    bundledAsrDiag,
    asrCaps,
    sttOnlineBridgeReady,
    funasrInstallMessage,
    prepareModelBusy,
    prepareModelProgress,
    prepareModelFailure,
    refreshAsrHealth,
    prepareDefaultFunasrModel,
    retryBundledAsrSidecar,
    installFunasrDepsInteractive,
    copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged,
  };
}
