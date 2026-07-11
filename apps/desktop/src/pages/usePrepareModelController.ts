import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { PrepareModelFailureCopy } from "./prepareModelDownloadCopy";
import type { RefreshAsrRuntimeOptions } from "./asrRuntimeRefreshOptions";
import {
  clampPrepareProgressPercent,
  monotonicPrepareProgress,
} from "./prepareModelProgress";
import { setAsrModelPrepareActive } from "../services/asr/asrPrepareActivityGate";
import type { BundledCopyPresentationSync } from "../services/asr/bundledAsrModelsSeedPrepare";
import {
  type PrepareDefaultModelOptions,
  type PrepareModelApi,
} from "./prepareModelTypes";
import { usePrepareModelCancel } from "./usePrepareModelCancel";
import { usePrepareModelRun } from "./usePrepareModelRun";

export type { PrepareDefaultModelOptions, PrepareModelApi };

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

  const prepareDefaultFunasrModel = usePrepareModelRun({
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
  });

  const cancelPrepareModel = usePrepareModelCancel({
    prepareModelBusy,
    prepareModelCancelling,
    refreshAsrRuntimeInfo,
    prepareModelAbortRef,
    prepareCancelRequestedRef,
    setPrepareModelBusy,
    setPrepareModelCancelling,
    setPrepareModelFailure,
    setFunasrInstallMessage,
    setProgressIfChanged,
  });

  const beginBundledCopyPresentation = useCallback(() => {
    flushSync(() => {
      setPrepareModelBusy(true);
      setPrepareModelCancelling(false);
      prepareCancelRequestedRef.current = false;
      setPrepareModelFailure(null);
      lastUiProgressRef.current = -1;
      setProgressIfChanged(0, { allowDecrease: true, monotonic: false });
      setAsrModelPrepareActive(true);
    });
  }, [setProgressIfChanged]);

  const setBundledCopyPresentationProgress = useCallback(
    (percent: number) => {
      setProgressIfChanged(percent, { monotonic: true });
    },
    [setProgressIfChanged],
  );

  const endBundledCopyPresentation = useCallback(() => {
    setAsrModelPrepareActive(false);
    setPrepareModelBusy(false);
  }, []);

  const bundledCopyPresentationSync = useMemo<BundledCopyPresentationSync>(
    () => ({
      begin: beginBundledCopyPresentation,
      setProgress: setBundledCopyPresentationProgress,
      end: endBundledCopyPresentation,
    }),
    [beginBundledCopyPresentation, endBundledCopyPresentation, setBundledCopyPresentationProgress],
  );

  return {
    prepareModelBusy,
    prepareModelCancelling,
    prepareModelProgress,
    prepareModelFailure,
    funasrInstallMessage,
    prepareDefaultFunasrModel,
    cancelPrepareModel,
    bundledCopyPresentationSync,
    setPrepareModelFailure,
    setFunasrInstallMessage,
  };
}
