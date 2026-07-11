import { useCallback, type MutableRefObject } from "react";
import { flushSync } from "react-dom";
import { asrBaseUrl, isDefaultBundledAsrTarget } from "../config/env";
import { fetchAsrHealthCaps } from "../services/asr/asrHealthSnapshot";
import { catalogEntryForHub, computeLocalAsrTranscribeReady } from "../services/asr/localAsrModelCatalog";
import { toast } from "../services/ui/toast";
import type { PrepareModelFailureCopy } from "./prepareModelDownloadCopy";
import {
  REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE,
  type RefreshAsrRuntimeOptions,
} from "./asrRuntimeRefreshOptions";
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
import type { PrepareDefaultModelOptions, PrepareProgressSetOptions } from "./prepareModelTypes";
import { runPrepareModelSidecarJob } from "./runPrepareModelSidecarJob";

export type UsePrepareModelRunArgs = {
  refreshAsrRuntimeInfo: (options?: RefreshAsrRuntimeOptions) => Promise<void>;
  getSelectedHubModelId: () => string;
  prepareModelAbortRef: MutableRefObject<AbortController | null>;
  prepareCancelRequestedRef: MutableRefObject<boolean>;
  prepareStageRef: MutableRefObject<{ message: string; startedAt: number }>;
  lastUiProgressRef: MutableRefObject<number>;
  lastInstallMessageAtRef: MutableRefObject<number>;
  setPrepareModelBusy: (v: boolean) => void;
  setPrepareModelCancelling: (v: boolean) => void;
  setPrepareModelProgress: (v: number) => void;
  setPrepareModelFailure: (v: PrepareModelFailureCopy | null) => void;
  setFunasrInstallMessage: (v: string) => void;
  setProgressIfChanged: (next: number, options?: PrepareProgressSetOptions) => void;
  setInstallMessageThrottled: (message: string, force?: boolean) => void;
};

export function usePrepareModelRun({
  refreshAsrRuntimeInfo,
  getSelectedHubModelId,
  prepareModelAbortRef,
  prepareCancelRequestedRef,
  prepareStageRef,
  lastUiProgressRef,
  lastInstallMessageAtRef,
  setPrepareModelBusy,
  setPrepareModelCancelling,
  setPrepareModelProgress,
  setPrepareModelFailure,
  setFunasrInstallMessage,
  setProgressIfChanged,
  setInstallMessageThrottled,
}: UsePrepareModelRunArgs) {
  return useCallback(async (options?: PrepareDefaultModelOptions) => {
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
          `${modelLabel} 与必需辅助模型已就绪，无需重复复制。`,
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
    try {
      await runPrepareModelSidecarJob({
        hubModelId,
        modelLabel,
        base,
        urlAsync,
        urlStatus,
        deadlineMs,
        force: options?.force === true,
        allowAutoResume: options?.skipAutoResume !== true,
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
      });
    } finally {
      setAsrModelPrepareActive(false);
      setPrepareModelBusy(false);
      setPrepareModelCancelling(false);
      prepareCancelRequestedRef.current = false;
      await refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
    }
  }, [
    getSelectedHubModelId,
    lastInstallMessageAtRef,
    lastUiProgressRef,
    prepareCancelRequestedRef,
    prepareModelAbortRef,
    prepareStageRef,
    refreshAsrRuntimeInfo,
    setFunasrInstallMessage,
    setInstallMessageThrottled,
    setPrepareModelBusy,
    setPrepareModelCancelling,
    setPrepareModelFailure,
    setPrepareModelProgress,
    setProgressIfChanged,
  ]);
}
