import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import type { AsrHealthCapabilities, AsrModelCacheInfo, WaveformPeaksCacheInfo } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { isOnlineTranscribeReady } from "../services/stt/sttOnlineProviderContract";
import { STT_ONLINE_RUNTIME_CHANGED_EVENT } from "../services/stt/sttOnlineRuntimeNotify";
import { usePrepareModelController, type PrepareModelApi } from "./usePrepareModelController";
import { useLocalAsrModelCatalog, type LocalAsrModelCatalogApi } from "./useLocalAsrModelCatalog";
import { buildAsrEnvPresentation, type AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { funasrManualSetupCommands } from "../services/asr/asrHealthParse";
import {
  useAsrHealthPoll,
  type AsrHealthRefreshOptions,
  type AsrHealthState,
} from "./useAsrHealthPoll";
import { useAsrModelCacheController } from "./useAsrModelCacheController";
import { refreshLocalAsrDiagnostics } from "./refreshLocalAsrDiagnostics";
import type { RefreshAsrRuntimeOptions } from "./asrRuntimeRefreshOptions";

export type { RefreshAsrRuntimeOptions } from "./asrRuntimeRefreshOptions";

export type { AsrHealthCapabilities } from "../tauri/projectApi";
export type { AsrHealthState };

export interface AsrBridgeApi {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  asrPresentation: AsrEnvPresentation;
  bundledAsrDiag: p1.BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  asrModelCacheInfo: AsrModelCacheInfo | null;
  waveformPeaksCacheInfo: WaveformPeaksCacheInfo | null;
  asrModelCacheBusy: boolean;
  sttOnlineBridgeReady: boolean;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelApi["prepareModelFailure"];
  refreshAsrHealth: (options?: AsrHealthRefreshOptions) => Promise<void>;
  refreshAsrRuntimeInfo: (options?: RefreshAsrRuntimeOptions) => Promise<void>;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  clearOrphanWaveformPeaksCache: () => Promise<void>;
  asrCacheMessage: string;
  prepareDefaultFunasrModel: PrepareModelApi["prepareDefaultFunasrModel"];
  cancelPrepareModel: () => void;
  localAsrModelCatalog: LocalAsrModelCatalogApi;
  retryBundledAsrSidecar: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  bumpSttOnlineRuntimeChanged: () => void;
  sttOnlineRuntimeEpoch: number;
}

type AsrBridgeOptions = {
  refreshSetupDiagnoseRef?: MutableRefObject<
    ((options?: {
      resetSteps?: boolean;
      touchUi?: boolean;
      skipLocalRuntimeDiagnose?: boolean;
    }) => Promise<unknown>) | null
  >;
};

export function useAsrBridgeController(options?: AsrBridgeOptions): AsrBridgeApi {
  const refreshSetupDiagnoseRef = options?.refreshSetupDiagnoseRef;
  const tauriRuntime = isTauriRuntime();
  const [sttOnlineBridgeEpoch, setSttOnlineBridgeEpoch] = useState(0);
  const [sttRuntimeRevision, setSttRuntimeRevision] = useState(0);
  const refreshAsrRuntimeInfoRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const bump = () => setSttRuntimeRevision((n) => n + 1);
    window.addEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, bump);
    return () => window.removeEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, bump);
  }, []);

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

  /* eslint-disable react-hooks/exhaustive-deps -- cacheCtrl is a stable hook-returned controller; only its method identity matters */
  const refreshAsrRuntimeInfo = useCallback(async (runtimeOptions?: RefreshAsrRuntimeOptions) => {
    await refreshLocalAsrDiagnostics(
      {
        refreshAsrHealth,
        refreshAsrModelCacheInfo: cacheCtrl.refreshAsrModelCacheInfo,
        refreshSetupDiagnose: refreshSetupDiagnoseRef?.current
          ? async (setupOptions) => {
              const refreshSetup = refreshSetupDiagnoseRef.current;
              if (refreshSetup) {
                await refreshSetup(setupOptions);
              }
            }
          : undefined,
      },
      runtimeOptions,
    );
  }, [cacheCtrl.refreshAsrModelCacheInfo, refreshAsrHealth, refreshSetupDiagnoseRef]);
  /* eslint-enable react-hooks/exhaustive-deps */
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

  /* eslint-disable react-hooks/exhaustive-deps -- bridgeReady depends on global STT runtime state; epochs force refresh but are not read inside the memo */
  const sttOnlineBridgeReady = useMemo(
    () => isOnlineTranscribeReady(),
    [sttOnlineBridgeEpoch, sttRuntimeRevision],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const bumpSttOnlineRuntimeChanged = useCallback(() => {
    setSttOnlineBridgeEpoch((n) => n + 1);
  }, []);

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

  const asrPresentation = useMemo(
    () =>
      buildAsrEnvPresentation({
        asrHealth,
        asrHealthDetail: asrHealthDetailDisplay,
        asrCaps,
        selectedHubModelId: localAsrModelCatalog.selectedHubModelId,
        catalogStatus: localAsrModelCatalog.catalogStatus,
        desktopModelsRoot: cacheCtrl.asrModelCacheInfo?.models_root ?? null,
        sidecarModelsRoot: asrCaps?.rushi_models_root ?? null,
        asrModelCacheBytes: cacheCtrl.asrModelCacheInfo?.total_bytes ?? 0,
        sidecarAsyncTranscribeCapable: localAsrModelCatalog.sidecarAsyncTranscribeCapable,
        prepareModelBusy: modelCtrl.prepareModelBusy,
        prepareModelCancelling: modelCtrl.prepareModelCancelling,
        prepareModelProgress: modelCtrl.prepareModelProgress,
      }),
    [
      asrHealth,
      asrHealthDetailDisplay,
      asrCaps,
      localAsrModelCatalog.selectedHubModelId,
      localAsrModelCatalog.catalogStatus,
      localAsrModelCatalog.sidecarAsyncTranscribeCapable,
      cacheCtrl.asrModelCacheInfo?.models_root,
      cacheCtrl.asrModelCacheInfo?.total_bytes,
      modelCtrl.prepareModelBusy,
      modelCtrl.prepareModelCancelling,
      modelCtrl.prepareModelProgress,
    ],
  );

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
            "已在所选仓库中执行安装脚本。未设置 RUSHI_FUNASR_MODEL 时将使用内置 Paraformer 长音频模型；请先下载当前所选模型，再开始正式转写。",
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
    asrPresentation,
    bundledAsrDiag,
    asrCaps,
    asrModelCacheInfo: cacheCtrl.asrModelCacheInfo,
    waveformPeaksCacheInfo: cacheCtrl.waveformPeaksCacheInfo,
    asrModelCacheBusy: cacheCtrl.asrModelCacheBusy,
    sttOnlineBridgeReady,
    funasrInstallMessage: modelCtrl.funasrInstallMessage,
    prepareModelBusy: modelCtrl.prepareModelBusy,
    prepareModelCancelling: modelCtrl.prepareModelCancelling,
    prepareModelProgress: modelCtrl.prepareModelProgress,
    prepareModelFailure: modelCtrl.prepareModelFailure,
    refreshAsrHealth,
    refreshAsrRuntimeInfo,
    refreshAsrModelCacheInfo: cacheCtrl.refreshAsrModelCacheInfo,
    clearAsrModelCache: cacheCtrl.clearAsrModelCache,
    clearOrphanWaveformPeaksCache: cacheCtrl.clearOrphanWaveformPeaksCache,
    asrCacheMessage: cacheCtrl.asrCacheMessage,
    prepareDefaultFunasrModel: modelCtrl.prepareDefaultFunasrModel,
    cancelPrepareModel: () => void modelCtrl.cancelPrepareModel(),
    localAsrModelCatalog,
    retryBundledAsrSidecar,
    installFunasrDepsInteractive,
    copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged,
    sttOnlineRuntimeEpoch: sttOnlineBridgeEpoch,
  };
}
