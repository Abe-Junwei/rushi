import { loopbackFetch } from "../services/asr/loopbackFetch";
import { hubModelNeedsPuncPrepare } from "../services/asr/localAsrModelCatalog";
import { toast } from "../services/ui/toast";
import {
  describePrepareModelFailure,
  type PrepareModelFailureCopy,
} from "./prepareModelDownloadCopy";
import {
  REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE,
  type RefreshAsrRuntimeOptions,
} from "./asrRuntimeRefreshOptions";
import { computePrepareModelProgress } from "./prepareModelProgress";
import { isPrepareModelResumableError, normalizePrepareModelErrorCode } from "./prepareModelResume";
import {
  buildPrepareJobPresentation,
  parseSidecarPrepareStatus,
  resolveCancelledPrepareProgress,
} from "../services/asr/prepareJobPresentation";
import {
  PREPARE_STATUS_POLL_MS,
  PREPARE_STATUS_TIMEOUT_MS,
  PREPARE_STATUS_TRANSIENT_RETRIES,
  loopbackFetchWithRetries,
  sleepMs,
} from "./prepareModelLoopback";
import type { PrepareProgressSetOptions } from "./prepareModelTypes";

export type RunPrepareModelSidecarJobArgs = {
  hubModelId: string;
  modelLabel: string;
  base: string;
  urlAsync: string;
  urlStatus: string;
  deadlineMs: number;
  force: boolean;
  allowAutoResume: boolean;
  ac: AbortController;
  prepareCancelRequestedRef: { current: boolean };
  prepareStageRef: { current: { message: string; startedAt: number } };
  lastUiProgressRef: { current: number };
  refreshAsrRuntimeInfo: (options?: RefreshAsrRuntimeOptions) => Promise<void>;
  setPrepareModelCancelling: (v: boolean) => void;
  setPrepareModelFailure: (v: PrepareModelFailureCopy | null) => void;
  setFunasrInstallMessage: (v: string) => void;
  setProgressIfChanged: (next: number, options?: PrepareProgressSetOptions) => void;
  setInstallMessageThrottled: (message: string, force?: boolean) => void;
};

/** Sidecar async prepare + status poll (+ one auto-resume). Pure async; no React. */
export async function runPrepareModelSidecarJob(args: RunPrepareModelSidecarJobArgs): Promise<void> {
  const {
    hubModelId,
    modelLabel,
    base,
    urlAsync,
    urlStatus,
    deadlineMs,
    force,
    allowAutoResume,
    ac,
    prepareCancelRequestedRef,
    prepareStageRef,
    lastUiProgressRef,
    refreshAsrRuntimeInfo,
    setPrepareModelCancelling,
    setPrepareModelFailure,
    setFunasrInstallMessage,
    setProgressIfChanged,
    setInstallMessageThrottled,
  } = args;

  const runT0 = Date.now();
  const deadline = runT0 + deadlineMs;
  const bumpProgress = (message: string) => {
    if (message !== prepareStageRef.current.message) {
      prepareStageRef.current = { message, startedAt: Date.now() };
    }
    const stageElapsed = Date.now() - prepareStageRef.current.startedAt;
    setProgressIfChanged(computePrepareModelProgress(message, stageElapsed), { monotonic: true });
  };

  resumeLoop: for (let resumeAttempt = 0; resumeAttempt < 2; resumeAttempt++) {
    try {
      const sidecarForce = force === true || resumeAttempt > 0;
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
            "已停止后台模型准备。未完成部分可在联网后重新点「一键准备」（支持断点续传）。",
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
            "若进度长时间不动，可取消后重新点「一键准备」（支持断点续传）。",
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
            "已停止后台模型准备。未完成部分可在联网后重新点「一键准备」（支持断点续传）。",
          );
          toast.info("已取消模型准备。可稍后重新点「一键准备」续传。");
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
              "已停止后台模型准备。未完成部分可在联网后重新点「一键准备」（支持断点续传）。",
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
          "已停止后台模型准备。未完成部分可在联网后重新点「一键准备」（支持断点续传）。",
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
}
