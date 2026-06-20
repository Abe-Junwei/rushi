import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { asrBaseUrl } from "../config/env";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import { fetchAsrHealthCaps } from "../services/asr/asrHealthSnapshot";
import { catalogEntryForHub, hubModelNeedsPuncPrepare } from "../services/asr/localAsrModelCatalog";
import { toast } from "../services/ui/toast";
import {
  describePrepareModelFailure,
  type PrepareModelFailureCopy,
} from "./prepareModelDownloadCopy";
import {
  REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE,
  type RefreshAsrRuntimeOptions,
} from "./asrRuntimeRefreshOptions";
import { computePrepareModelProgress, parsePrepareProgressPercent } from "./prepareModelProgress";
import { isPrepareModelResumableError } from "./prepareModelResume";
import {
  setAsrModelPrepareActive,
} from "../services/asr/asrPrepareActivityGate";

const PREPARE_STATUS_POLL_MS = 1000;
const PREPARE_STATUS_TIMEOUT_MS = 30_000;
const PREPARE_STATUS_TRANSIENT_RETRIES = 5;
const PREPARE_STATUS_RETRY_DELAY_MS = 2000;
const PREPARE_STALL_FORCE_RESTART_MS = 120_000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loopbackFetchWithRetries(
  url: string,
  init: Parameters<typeof loopbackFetch>[1] | undefined,
  retries: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await loopbackFetch(url, init);
    } catch (error) {
      lastError = error;
      if (init?.signal?.aborted) throw error;
      if (attempt < retries - 1) {
        await sleepMs(PREPARE_STATUS_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

export type PrepareDefaultModelOptions = {
  /** When true, still call sidecar prepare even if UI shows cached (re-verify / resume). */
  force?: boolean;
  /** Internal: skip auto-resume after a network-sidecar failure. */
  skipAutoResume?: boolean;
};

export interface PrepareModelApi {
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  funasrInstallMessage: string;
  prepareDefaultFunasrModel: (options?: PrepareDefaultModelOptions) => Promise<void>;
  cancelPrepareModel: () => Promise<void>;
  setPrepareModelFailure: (v: PrepareModelFailureCopy | null) => void;
  setFunasrInstallMessage: (v: string) => void;
}

export function usePrepareModelController(
  refreshAsrRuntimeInfo: (options?: RefreshAsrRuntimeOptions) => Promise<void>,
  getSelectedHubModelId: () => string,
): PrepareModelApi {
  const [funasrInstallMessage, setFunasrInstallMessage] = useState<string>("");
  const [prepareModelBusy, setPrepareModelBusy] = useState(false);
  const [prepareModelCancelling, setPrepareModelCancelling] = useState(false);
  const [prepareModelProgress, setPrepareModelProgress] = useState(0);
  const [prepareModelFailure, setPrepareModelFailure] = useState<PrepareModelFailureCopy | null>(null);

  const prepareModelAbortRef = useRef<AbortController | null>(null);
  const prepareCancelRequestedRef = useRef(false);
  const prepareStageRef = useRef({ message: "", startedAt: 0 });
  const lastUiProgressRef = useRef(-1);
  const lastInstallMessageAtRef = useRef(0);

  const setProgressIfChanged = useCallback((next: number) => {
    if (next === lastUiProgressRef.current) return;
    lastUiProgressRef.current = next;
    setPrepareModelProgress(next);
  }, []);

  const setInstallMessageThrottled = useCallback((message: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastInstallMessageAtRef.current < 4000) return;
    lastInstallMessageAtRef.current = now;
    setFunasrInstallMessage(message);
  }, []);

  useEffect(() => {
    return () => {
      prepareModelAbortRef.current?.abort();
    };
  }, []);

  const prepareDefaultFunasrModel = useCallback(async (options?: PrepareDefaultModelOptions) => {
    prepareModelAbortRef.current?.abort();
    const ac = new AbortController();
    prepareModelAbortRef.current = ac;
    const hubModelId = getSelectedHubModelId();
    const entry = catalogEntryForHub(hubModelId);
    const modelLabel = entry?.label ?? hubModelId;
    const base = asrBaseUrl().replace(/\/+$/, "");
    const urlAsync = `${base}/v1/models/prepare/async`;
    const urlStatus = `${base}/v1/models/prepare-status`;
    const deadlineMs = 900_000;

    // Busy / activity gate 必须前置：从用户点击瞬间起就抑制「已就绪」类文案，
    // 避免 health 预检窗口内 buildAsrEnvPresentation 仍用旧 caps。
    // flushSync 确保父组件在 precheck 之前已看到 busy=true。
    flushSync(() => {
      setPrepareModelBusy(true);
      setPrepareModelCancelling(false);
      prepareCancelRequestedRef.current = false;
      setPrepareModelFailure(null);
      prepareStageRef.current = { message: "", startedAt: Date.now() };
      lastUiProgressRef.current = -1;
      lastInstallMessageAtRef.current = 0;
      setProgressIfChanged(0);
      setAsrModelPrepareActive(true);
    });

    if (!options?.force) {
      const caps = await fetchAsrHealthCaps();
      if (
        caps?.ready_for_transcribe === true &&
        caps.funasr_model_id === hubModelId &&
        caps.selected_model_ready !== false
      ) {
        setPrepareModelProgress(100);
        setFunasrInstallMessage(
          `${modelLabel} 与必需辅助模型已准备（或已在缓存中）。无需重复下载。`,
        );
        await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
        setAsrModelPrepareActive(false);
        setPrepareModelBusy(false);
        return;
      }
      setInstallMessageThrottled(
        "将校验并拉取当前所选模型（若已在磁盘缓存，侧车会快速完成，不会重复下载大文件）。",
        true,
      );
    } else {
      setFunasrInstallMessage("");
    }
    const runT0 = Date.now();
    const deadline = runT0 + deadlineMs;
    const formatWait = () => {
      const secs = Math.floor((Date.now() - runT0) / 1000);
      const mm = Math.floor(secs / 60);
      const ss = secs % 60;
      return `${mm}:${ss.toString().padStart(2, "0")}`;
    };
    const bumpProgress = (message: string) => {
      if (message !== prepareStageRef.current.message) {
        prepareStageRef.current = { message, startedAt: Date.now() };
      }
      const stageElapsed = Date.now() - prepareStageRef.current.startedAt;
      setProgressIfChanged(computePrepareModelProgress(message, stageElapsed));
    };
    const allowAutoResume = options?.skipAutoResume !== true;
    try {
      resumeLoop: for (let resumeAttempt = 0; resumeAttempt < 2; resumeAttempt++) {
        try {
        const sidecarForce = options?.force === true || resumeAttempt > 0;
        if (resumeAttempt > 0) {
          try {
            await loopbackFetch(`${base}/v1/models/prepare-cancel`, { method: "POST" });
          } catch {
            /* ignore */
          }
          setPrepareModelFailure(null);
          setFunasrInstallMessage("网络中断，正在从已下载部分续传…");
          await sleepMs(1500);
        }
        let lastProgressBumpAt = Date.now();
        let lastProgressValue = -1;
        let retryForResume = false;

        const start = await loopbackFetch(urlAsync, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_id: hubModelId, force: sidecarForce }),
          signal: ac.signal,
        });
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
        if (sj.started !== true && sj.reason === "prepare_stuck") {
          setPrepareModelFailure({
            headline: "模型下载未能重启",
            tips: [
              "上一段下载仍在侧车中运行。请稍候、点「取消下载」，或重启侧车后再试。",
              "若进度长时间不动，可取消后重新点「下载当前模型」（支持断点续传）。",
            ],
          });
          return;
        }
        while (Date.now() < deadline) {
          if (ac.signal.aborted) return;
          const stRes = await loopbackFetchWithRetries(
            urlStatus,
            { signal: ac.signal, loopbackTimeoutMs: PREPARE_STATUS_TIMEOUT_MS },
            PREPARE_STATUS_TRANSIENT_RETRIES,
          );
          const st = (await stRes.json().catch(() => ({}))) as Record<string, unknown>;
          const phase = typeof st.phase === "string" ? st.phase : "?";
          const message = typeof st.message === "string" ? st.message : "";
          if (phase === "running") {
            if (prepareCancelRequestedRef.current) {
              setInstallMessageThrottled("正在取消下载，等待侧车结束当前传输…", true);
            } else {
              const serverPercent = parsePrepareProgressPercent(st.progress_percent);
              if (serverPercent != null) {
                setProgressIfChanged(serverPercent);
                if (serverPercent !== lastProgressValue) {
                  lastProgressValue = serverPercent;
                  lastProgressBumpAt = Date.now();
                }
              } else {
                bumpProgress(message);
                lastProgressBumpAt = Date.now();
              }
              const stage =
                message === "downloading_vad"
                  ? "正在下载必需辅助模型（VAD）…"
                  : message === "downloading_punc"
                    ? "正在下载标点模型（ct-punc）…"
                    : `正在下载主模型（${modelLabel}）…`;
              setInstallMessageThrottled(
                `${stage} 已等待 ${formatWait()}。请保持应用开启并联网，尽量不要关闭当前窗口。`,
              );
              if (
                allowAutoResume &&
                resumeAttempt === 0 &&
                Date.now() - lastProgressBumpAt > PREPARE_STALL_FORCE_RESTART_MS
              ) {
                retryForResume = true;
                break;
              }
            }
          } else if (phase === "idle") {
          if (Date.now() - runT0 < 4000) {
            bumpProgress("starting");
            setInstallMessageThrottled("正在启动后台下载任务，请稍候…", true);
          } else {
            // 不再用 /health.ready_for_transcribe 跳过 prepare：防止旧缓存导致
            // 「先就绪再下载」错觉，也避免与 prepare 线程的 idle→running 竞态。
            setInstallMessageThrottled(
              "模型准备状态仍为 idle：请重新检测 ASR 服务，或回到「一键准备本机 ASR」后再试。",
              true,
            );
          }
        } else if (phase === "?") {
          setInstallMessageThrottled("无法读取模型准备状态，请确认 rushi-asr 已升级后重试。", true);
        }
        if (phase === "done") {
          setProgressIfChanged(100);
          const result = st.result as Record<string, unknown> | null | undefined;
          const warns = Array.isArray(result?.warnings)
            ? (result?.warnings as string[]).join("；")
            : "";
          const needsPunc = hubModelNeedsPuncPrepare(hubModelId);
          const puncPath = typeof result?.punc_path === "string" ? result.punc_path : "";
          const lines = [
            `${modelLabel} 与必需辅助模型已准备（或已在缓存中）。`,
            warns ? `提示：${warns}` : "",
            typeof result?.path === "string" ? `缓存路径：${result.path}` : "",
            typeof result?.vad_path === "string" ? `VAD 路径：${result.vad_path}` : "",
            puncPath ? `标点模型路径：${puncPath}` : "",
          ];
          if (needsPunc && !puncPath) {
            lines.push(
              "警告：侧车未返回标点模型路径（punc_path），多为旧版 rushi-asr。请点「重试内置侧车」后再次校验，否则长音频可能只有整轨单语段。",
            );
          }
          setFunasrInstallMessage(lines.filter(Boolean).join("\n"));
          await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
          return;
        }
        if (phase === "cancelled") {
          prepareCancelRequestedRef.current = false;
          setPrepareModelCancelling(false);
          setProgressIfChanged(0);
          setFunasrInstallMessage(
            "已停止后台模型下载。未完成部分可在联网后重新点「下载当前模型」（支持断点续传）。",
          );
          toast.info("已取消模型下载。可稍后重新点「下载当前模型」续传。");
          await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
          return;
        }
        if (phase === "error") {
          const code = typeof st.error_code === "string" ? st.error_code : "unknown";
          if (allowAutoResume && resumeAttempt === 0 && isPrepareModelResumableError(code)) {
            retryForResume = true;
            break;
          }
          setFunasrInstallMessage("");
          setPrepareModelFailure(describePrepareModelFailure(code));
          return;
        }
        await new Promise<void>((r, rej) => {
          const t = setTimeout(r, PREPARE_STATUS_POLL_MS);
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
        if (retryForResume && allowAutoResume && resumeAttempt === 0) {
          continue resumeLoop;
        }
        setFunasrInstallMessage("");
        setPrepareModelFailure(describePrepareModelFailure("client_timeout"));
        return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            if (prepareCancelRequestedRef.current) {
              setFunasrInstallMessage("已取消等待模型下载。");
              toast.info("已取消模型下载。");
            }
            return;
          }
          if (allowAutoResume && resumeAttempt === 0) {
            try {
              await loopbackFetch(`${base}/v1/models/prepare-cancel`, { method: "POST" });
            } catch {
              /* ignore */
            }
            setPrepareModelFailure(null);
            setFunasrInstallMessage("连接侧车失败，正在从已下载部分续传…");
            await sleepMs(1500);
            continue resumeLoop;
          }
          setFunasrInstallMessage("");
          setPrepareModelFailure(describePrepareModelFailure("fetch_failed"));
          return;
        }
      }
    } finally {
      setAsrModelPrepareActive(false);
      setPrepareModelBusy(false);
      setPrepareModelCancelling(false);
      prepareCancelRequestedRef.current = false;
      await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
    }
  }, [getSelectedHubModelId, refreshAsrRuntimeInfo, setInstallMessageThrottled, setProgressIfChanged]);

  const cancelPrepareModel = useCallback(async () => {
    if (!prepareModelBusy || prepareModelCancelling) return;
    setPrepareModelFailure(null);
    const base = asrBaseUrl().replace(/\/+$/, "");
    setPrepareModelCancelling(true);
    prepareCancelRequestedRef.current = true;
    setFunasrInstallMessage("正在请求停止后台下载…");
    try {
      const res = await loopbackFetch(`${base}/v1/models/prepare-cancel`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (body.cancelled === true) {
        setFunasrInstallMessage("正在取消下载，等待侧车结束当前传输…");
        toast.info("已请求取消下载，侧车将在当前文件传完后停止。");
        return;
      }
      setFunasrInstallMessage("侧车无进行中的下载；已结束等待。");
      toast.info("侧车无进行中的下载，已停止等待。");
      prepareModelAbortRef.current?.abort();
      setPrepareModelBusy(false);
      setPrepareModelCancelling(false);
      prepareCancelRequestedRef.current = false;
      setProgressIfChanged(0);
      await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
    } catch {
      setFunasrInstallMessage(
        "无法联系 ASR 取消下载；可点「重新检测 ASR」或重启侧车后再试。",
      );
      toast.error("无法联系侧车取消下载；已停止等待。");
      prepareModelAbortRef.current?.abort();
      setPrepareModelBusy(false);
      setPrepareModelCancelling(false);
      prepareCancelRequestedRef.current = false;
      setProgressIfChanged(0);
      await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
    }
  }, [prepareModelBusy, prepareModelCancelling, refreshAsrRuntimeInfo, setProgressIfChanged]);

  return {
    prepareModelBusy,
    prepareModelCancelling,
    prepareModelProgress,
    prepareModelFailure,
    funasrInstallMessage,
    prepareDefaultFunasrModel,
    cancelPrepareModel,
    setPrepareModelFailure,
    setFunasrInstallMessage,
  };
}
