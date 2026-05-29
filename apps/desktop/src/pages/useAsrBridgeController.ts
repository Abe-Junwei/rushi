import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import type { AsrHealthCapabilities, AsrModelCacheInfo } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { tryBuildOnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";
import { usePrepareModelController, type PrepareModelApi } from "./usePrepareModelController";
import { useLocalAsrModelCatalog, type LocalAsrModelCatalogApi } from "./useLocalAsrModelCatalog";
import { funasrManualSetupCommands } from "../services/asr/asrHealthParse";
import {
  useAsrHealthPoll,
  type AsrHealthRefreshOptions,
  type AsrHealthState,
} from "./useAsrHealthPoll";
import { useAsrModelCacheController } from "./useAsrModelCacheController";

export type { AsrHealthCapabilities } from "../tauri/projectApi";
export { funasrManualSetupCommands, parseAsrHealthJson } from "../services/asr/asrHealthParse";
export type { AsrHealthState };

export interface AsrBridgeApi {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  bundledAsrDiag: p1.BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  asrModelCacheInfo: AsrModelCacheInfo | null;
  asrModelCacheBusy: boolean;
  sttOnlineBridgeReady: boolean;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelApi["prepareModelFailure"];
  refreshAsrHealth: (options?: AsrHealthRefreshOptions) => Promise<void>;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  asrCacheMessage: string;
  prepareDefaultFunasrModel: PrepareModelApi["prepareDefaultFunasrModel"];
  cancelPrepareModel: () => void;
  localAsrModelCatalog: LocalAsrModelCatalogApi;
  retryBundledAsrSidecar: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  bumpSttOnlineRuntimeChanged: () => void;
}

type AsrBridgeOptions = {
  refreshEnvironmentDiagnostics?: () => Promise<void>;
};

export function useAsrBridgeController(options?: AsrBridgeOptions): AsrBridgeApi {
  const refreshEnvironmentDiagnostics = options?.refreshEnvironmentDiagnostics;
  const tauriRuntime = isTauriRuntime();
  const [sttOnlineBridgeEpoch, setSttOnlineBridgeEpoch] = useState(0);
  const refreshAsrRuntimeInfoRef = useRef<() => Promise<void>>(async () => {});

  const catalogHooksRef = useRef({
    syncFromHealth: (_healthJson: unknown, _rootJson?: unknown) => {},
    refreshIfNeeded: (_healthJson: unknown) => {},
  });

  const {
    asrHealth,
    asrHealthDetail,
    bundledAsrDiag,
    asrCaps,
    refreshAsrHealth,
    refreshBundledAsrDiag,
  } = useAsrHealthPoll({ tauriRuntime, catalogHooksRef });

  const cacheCtrl = useAsrModelCacheController({
    tauriRuntime,
    onAfterCacheMutation: async () => refreshAsrRuntimeInfoRef.current(),
  });

  const refreshAsrRuntimeInfo = useCallback(async () => {
    await refreshAsrHealth();
    await cacheCtrl.refreshAsrModelCacheInfo();
    await refreshEnvironmentDiagnostics?.();
  }, [cacheCtrl.refreshAsrModelCacheInfo, refreshAsrHealth, refreshEnvironmentDiagnostics]);
  refreshAsrRuntimeInfoRef.current = refreshAsrRuntimeInfo;

  const localAsrModelCatalog = useLocalAsrModelCatalog(refreshAsrRuntimeInfo);
  catalogHooksRef.current = {
    syncFromHealth: localAsrModelCatalog.syncCatalogFromHealth,
    refreshIfNeeded: () => {
      void localAsrModelCatalog.refreshCatalogFromSidecar();
    },
  };

  const modelCtrl = usePrepareModelController(
    refreshAsrRuntimeInfo,
    () => localAsrModelCatalog.selectedHubModelId,
  );

  const sttOnlineBridgeReady = useMemo(
    () => tryBuildOnlineTranscribeBridgePayload() !== null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sttOnlineBridgeEpoch],
  );

  const bumpSttOnlineRuntimeChanged = useCallback(() => {
    setSttOnlineBridgeEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    void refreshAsrHealth();
    void cacheCtrl.refreshAsrModelCacheInfo();
  }, [cacheCtrl.refreshAsrModelCacheInfo, refreshAsrHealth]);

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
    } catch {
      /* ignore */
    } finally {
      await refreshAsrRuntimeInfo();
    }
  }, [refreshAsrRuntimeInfo, refreshBundledAsrDiag]);

  const installFunasrDepsInteractive = useCallback(async () => {
    modelCtrl.setPrepareModelFailure(null);
    modelCtrl.setFunasrInstallMessage("");
    try {
      const log = await p1.installFunasrDepsInteractive();
      if (log != null && log.length > 0) {
        modelCtrl.setFunasrInstallMessage(
          [
            "已在所选仓库中执行安装脚本。未设置 RUSHI_FUNASR_MODEL 时将使用内置 SenseVoiceSmall；请先下载当前所选模型，再开始正式转写。",
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
    asrModelCacheInfo: cacheCtrl.asrModelCacheInfo,
    asrModelCacheBusy: cacheCtrl.asrModelCacheBusy,
    sttOnlineBridgeReady,
    funasrInstallMessage: modelCtrl.funasrInstallMessage,
    prepareModelBusy: modelCtrl.prepareModelBusy,
    prepareModelProgress: modelCtrl.prepareModelProgress,
    prepareModelFailure: modelCtrl.prepareModelFailure,
    refreshAsrHealth,
    refreshAsrModelCacheInfo: cacheCtrl.refreshAsrModelCacheInfo,
    clearAsrModelCache: cacheCtrl.clearAsrModelCache,
    asrCacheMessage: cacheCtrl.asrCacheMessage,
    prepareDefaultFunasrModel: modelCtrl.prepareDefaultFunasrModel,
    cancelPrepareModel: () => void modelCtrl.cancelPrepareModel(),
    localAsrModelCatalog,
    retryBundledAsrSidecar,
    installFunasrDepsInteractive,
    copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged,
  };
}
