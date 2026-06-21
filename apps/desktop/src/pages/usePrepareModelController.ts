import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { asrBaseUrl, isDefaultBundledAsrTarget } from "../config/env";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import { fetchAsrHealthCaps } from "../services/asr/asrHealthSnapshot";
import { catalogEntryForHub, hubModelNeedsPuncPrepare, computeLocalAsrTranscribeReady } from "../services/asr/localAsrModelCatalog";
import { toast } from "../services/ui/toast";
import {
  describePrepareModelFailure,
  type PrepareModelFailureCopy,
} from "./prepareModelDownloadCopy";
import {
  REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE,
  type RefreshAsrRuntimeOptions,
} from "./asrRuntimeRefreshOptions";
import {
  clampPrepareProgressPercent,
  computePrepareModelProgress,
  monotonicPrepareProgress,
} from "./prepareModelProgress";
import { isPrepareModelResumableError, normalizePrepareModelErrorCode } from "./prepareModelResume";
import {
  buildPrepareJobPresentation,
  parseSidecarPrepareStatus,
  resolveCancelledPrepareProgress,
} from "../services/asr/prepareJobPresentation";
import {
  setAsrModelPrepareActive,
  isBundledAsrModelsSeedActive,
} from "../services/asr/asrPrepareActivityGate";
import { ensureBundledAsrModelsSeededForPrepare } from "../services/asr/bundledAsrModelsSeedPrepare";
import {
  bundledModelsMissingTipsDev,
  bundledModelsMissingTipsManaged,
  packagedOrDevArray,
} from "../services/packagedUserHints";

const PREPARE_STATUS_POLL_MS = 1000;
const PREPARE_STATUS_TIMEOUT_MS = 30_000;
const PREPARE_STATUS_TRANSIENT_RETRIES = 5;
const PREPARE_STATUS_RETRY_DELAY_MS = 2000;
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

  const setProgressIfChanged = useCallback(
    (next: number, options?: { allowDecrease?: boolean; monotonic?: boolean }) => {
      const clamped = clampPrepareProgressPercent(next, "running");
      let value = clamped;
      if (
        options?.monotonic !== false &&
        !options?.allowDecrease &&
        lastUiProgressRef.current >= 0
      ) {
        value = monotonicPrepareProgress(lastUiProgressRef.current, clamped);
      }
      if (value === lastUiProgressRef.current) return;
      lastUiProgressRef.current = value;
      setPrepareModelProgress(value);
    },
    [],
  );

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
    if (isBundledAsrModelsSeedActive()) {
      toast.warning("内置语音模型正在准备中，请等待完成。");
      return;
    }
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
      setProgressIfChanged(0, { allowDecrease: true, monotonic: false });
      setAsrModelPrepareActive(true);
    });

    if (!options?.force) {
      const caps = await fetchAsrHealthCaps();
      const { ready: selectedReady, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
        asrHealth: caps ? "ok" : "error",
        asrCaps: caps,
        selectedHubModelId: hubModelId,
      });
      if (selectedReady && sidecarMatchesSelection) {
        setPrepareModelProgress(100);
        setFunasrInstallMessage(
          `${modelLabel} 与必需辅助模型已准备（或已在缓存中）。无需重复下载。`,
        );
        await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
        setAsrModelPrepareActive(false);
        setPrepareModelBusy(false);
        return;
      }
    } else {
      setFunasrInstallMessage("");
    }

    if (isDefaultBundledAsrTarget()) {
      setInstallMessageThrottled("正在从安装包复制内置语音模型…", true);
      const outcome = await ensureBundledAsrModelsSeededForPrepare({
        onProgress: (percent, message) => {
          setProgressIfChanged(percent, { monotonic: true });
          setInstallMessageThrottled(message, true);
        },
      });
      if (outcome.ok) {
        setProgressIfChanged(100, { allowDecrease: true, monotonic: false });
        setFunasrInstallMessage(outcome.message);
        await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
      } else {
        setPrepareModelFailure({
          headline: outcome.message,
          tips: outcome.noBundle
            ? packagedOrDevArray(bundledModelsMissingTipsDev, bundledModelsMissingTipsManaged)
            : ["可尝试重启应用，或环境页点「重试内置侧车」。", "若仍失败，请清除模型缓存后重启（会重新从安装包复制）。"],
        });
      }
      setAsrModelPrepareActive(false);
      setPrepareModelBusy(false);
      return;
    }

    if (!options?.force) {
      setInstallMessageThrottled(
        "将校验并拉取当前所选模型（若已在磁盘缓存，侧车会快速完成，不会重复下载大文件）。",
        true,
      );
    }
    const runT0 = Date.now();
    const deadline = runT0 + deadlineMs;
    const bumpProgress = (message: string) => {
      if (message !== prepareStageRef.current.message) {
        prepareStageRef.current = { message, startedAt: Date.now() };
      }
      const stageElapsed = Date.now() - prepareStageRef.current.startedAt;
      setProgressIfChanged(computePrepareModelProgress(message, stageElapsed), { monotonic: true });
    };
    const allowAutoResume = options?.skipAutoResume !== true;
    try {
      resumeLoop: for (let resumeAttempt = 0; resumeAttempt < 2; resumeAttempt++) {
        try {
        const sidecarForce = options?.force === true || resumeAttempt > 0;
        if (resumeAttempt > 0) {
          if (prepareCancelRequestedRef.current) {
            setProgressIfChanged(
              resolveCancelledPrepareProgress(
                undefined,
                lastUiProgressRef.current >= 0 ? lastUiProgressRef.current : -1,
              ),
              { allowDecrease: true, monotonic: false },
            );
            setFunasrInstallMessage(
              "已停止后台模型下载。未完成部分可在联网后重新点「下载当前模型」（支持断点续传）。",
            );
            break resumeLoop;
          }
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
          const code = normalizePrepareModelErrorCode(
            typeof d === "string" ? d : start.status === 507 ? "model_prepare_disk_full" : `http_${start.status}`,
          );
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
          const status = parseSidecarPrepareStatus(st);
          const phase = status.phase;
          const message = status.message;
          if (phase === "running") {
            if (prepareCancelRequestedRef.current) {
              const presentation = buildPrepareJobPresentation({
                status,
                localBusy: true,
                cancelling: true,
                modelLabel,
                progressOverride: lastProgressValue >= 0 ? lastProgressValue : undefined,
              });
              setProgressIfChanged(presentation.progress, { monotonic: false });
              setInstallMessageThrottled(presentation.installMessage);
            } else {
            if (message !== prepareStageRef.current.message) {
              prepareStageRef.current = { message, startedAt: Date.now() };
            }
            const presentation = buildPrepareJobPresentation({
              status,
              localBusy: true,
              cancelling: false,
              modelLabel,
              stageStartedAtMs: prepareStageRef.current.startedAt,
              lastLocalProgressAtMs: lastProgressBumpAt,
              waitElapsedMs: Date.now() - runT0,
            });
            setProgressIfChanged(presentation.progress, { monotonic: true });
            if (presentation.progress !== lastProgressValue) {
              lastProgressValue = presentation.progress;
              lastProgressBumpAt = Date.now();
            }
            setInstallMessageThrottled(presentation.installMessage);
            if (allowAutoResume && resumeAttempt === 0 && presentation.shouldForceResume) {
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
          setProgressIfChanged(100, { allowDecrease: true, monotonic: false });
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
          setProgressIfChanged(resolveCancelledPrepareProgress(status, lastProgressValue), {
            allowDecrease: true,
            monotonic: false,
          });
          setFunasrInstallMessage(
            "已停止后台模型下载。未完成部分可在联网后重新点「下载当前模型」（支持断点续传）。",
          );
          toast.info("已取消模型下载。可稍后重新点「下载当前模型」续传。");
          await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
          return;
        }
        if (phase === "error") {
          const code = normalizePrepareModelErrorCode(
            typeof st.error_code === "string" ? st.error_code : "unknown",
          );
          if (
            allowAutoResume &&
            resumeAttempt === 0 &&
            !prepareCancelRequestedRef.current &&
            isPrepareModelResumableError(code)
          ) {
            retryForResume = true;
            break;
          }
          if (prepareCancelRequestedRef.current) {
            prepareCancelRequestedRef.current = false;
            setPrepareModelCancelling(false);
            setProgressIfChanged(resolveCancelledPrepareProgress(status, lastProgressValue), {
              allowDecrease: true,
              monotonic: false,
            });
            setFunasrInstallMessage(
              "已停止后台模型下载。未完成部分可在联网后重新点「下载当前模型」（支持断点续传）。",
            );
            return;
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
        if (retryForResume && allowAutoResume && resumeAttempt === 0 && !prepareCancelRequestedRef.current) {
          continue resumeLoop;
        }
        if (prepareCancelRequestedRef.current) {
          setProgressIfChanged(resolveCancelledPrepareProgress(undefined, lastProgressValue), {
            allowDecrease: true,
            monotonic: false,
          });
          setFunasrInstallMessage(
            "已停止后台模型下载。未完成部分可在联网后重新点「下载当前模型」（支持断点续传）。",
          );
          return;
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
          if (allowAutoResume && resumeAttempt === 0 && !prepareCancelRequestedRef.current) {
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
      setProgressIfChanged(0, { allowDecrease: true, monotonic: false });
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
      setProgressIfChanged(0, { allowDecrease: true, monotonic: false });
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
