import { useCallback, type MutableRefObject } from "react";
import { asrBaseUrl, isDefaultBundledAsrTarget } from "../config/env";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import { toast } from "../services/ui/toast";
import type { PrepareModelFailureCopy } from "./prepareModelDownloadCopy";
import {
  REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE,
  type RefreshAsrRuntimeOptions,
} from "./asrRuntimeRefreshOptions";
import type { PrepareProgressSetOptions } from "./prepareModelTypes";

export type UsePrepareModelCancelArgs = {
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  refreshAsrRuntimeInfo: (options?: RefreshAsrRuntimeOptions) => Promise<void>;
  prepareModelAbortRef: MutableRefObject<AbortController | null>;
  prepareCancelRequestedRef: MutableRefObject<boolean>;
  setPrepareModelBusy: (v: boolean) => void;
  setPrepareModelCancelling: (v: boolean) => void;
  setPrepareModelFailure: (v: PrepareModelFailureCopy | null) => void;
  setFunasrInstallMessage: (v: string) => void;
  setProgressIfChanged: (next: number, options?: PrepareProgressSetOptions) => void;
};

export function usePrepareModelCancel({
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
}: UsePrepareModelCancelArgs) {
  return useCallback(async () => {
    if (isDefaultBundledAsrTarget()) {
      toast.info("内置模型复制进行中，请等待完成；也可重启应用从头复制。");
      return;
    }
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
  }, [
    prepareCancelRequestedRef,
    prepareModelAbortRef,
    prepareModelBusy,
    prepareModelCancelling,
    refreshAsrRuntimeInfo,
    setFunasrInstallMessage,
    setPrepareModelBusy,
    setPrepareModelCancelling,
    setPrepareModelFailure,
    setProgressIfChanged,
  ]);
}
