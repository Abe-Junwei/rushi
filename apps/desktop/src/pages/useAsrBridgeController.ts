import { useCallback, useEffect, useMemo, useState } from "react";
import { asrHealthUrl, isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import type { AsrHealthCapabilities } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import {
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import { usePrepareModelController, type PrepareModelApi } from "./usePrepareModelController";

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
  prepareModelFailure: PrepareModelApi["prepareModelFailure"];
  refreshAsrHealth: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  bumpSttOnlineRuntimeChanged: () => void;
}

export function useAsrBridgeController(): AsrBridgeApi {
  const tauriRuntime = isTauriRuntime();
  const [asrHealth, setAsrHealth] = useState<AsrHealthState>("checking");
  const [asrHealthDetail, setAsrHealthDetail] = useState<string>("");
  const [bundledAsrDiag, setBundledAsrDiag] = useState<p1.BundledAsrLaunchReport | null>(null);
  const [asrCaps, setAsrCaps] = useState<AsrHealthCapabilities | null>(null);
  const [sttOnlineBridgeEpoch, setSttOnlineBridgeEpoch] = useState(0);

  const sttOnlineBridgeReady = useMemo(
    () => tryBuildOnlineTranscribeBridgePayload() !== null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!tauriRuntime) {
      setAsrHealth("ok");
      setAsrHealthDetail("浏览器预览环境不自动检测本机 ASR。请在 Tauri 桌面壳中验证本地 ASR 连通性。");
      setAsrCaps(null);
      setBundledAsrDiag(null);
      return;
    }
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
  }, [refreshBundledAsrDiag, tauriRuntime]);

  const modelCtrl = usePrepareModelController(refreshAsrHealth, asrCaps);

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

  const retryBundledAsrSidecar = useCallback(async () => {
    try {
      await p1.retryBundledAsrSidecar();
      await refreshBundledAsrDiag();
      await refreshAsrHealth();
    } catch {
      /* ignore */
    }
  }, [refreshAsrHealth, refreshBundledAsrDiag]);

  const installFunasrDepsInteractive = useCallback(async () => {
    modelCtrl.setPrepareModelFailure(null);
    modelCtrl.setFunasrInstallMessage("");
    try {
      const log = await p1.installFunasrDepsInteractive();
      if (log != null && log.length > 0) {
        modelCtrl.setFunasrInstallMessage(
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
  }, [refreshAsrHealth, modelCtrl]);

  const copyFunasrManualCommands = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(funasrManualSetupCommands());
      modelCtrl.setFunasrInstallMessage("已复制手动安装命令到剪贴板（请在终端粘贴执行）。");
    } catch {
      /* ignore */
    }
  }, [modelCtrl]);

  return {
    asrHealth,
    asrHealthDetail: asrHealthDetailDisplay,
    bundledAsrDiag,
    asrCaps,
    sttOnlineBridgeReady,
    funasrInstallMessage: modelCtrl.funasrInstallMessage,
    prepareModelBusy: modelCtrl.prepareModelBusy,
    prepareModelProgress: modelCtrl.prepareModelProgress,
    prepareModelFailure: modelCtrl.prepareModelFailure,
    refreshAsrHealth,
    prepareDefaultFunasrModel: modelCtrl.prepareDefaultFunasrModel,
    retryBundledAsrSidecar,
    installFunasrDepsInteractive,
    copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged,
  };
}
