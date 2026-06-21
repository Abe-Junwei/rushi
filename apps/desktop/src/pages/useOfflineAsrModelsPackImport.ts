import { useCallback, useEffect, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { fetchAppVersion } from "../tauri/appInfoApi";
import * as p1 from "../tauri/projectApi";
import { cancelOfflineAsrModelsPackImport } from "../tauri/projectAsrMaintenanceApi";
import { runOfflineAsrModelsPackImportFlow } from "../services/asr/offlineAsrModelsPackFlow";
import type { LocalAsrCatalogStatusItem } from "../services/asr/localAsrModelCatalog";
import { toast } from "../services/ui/toast";

type UseOfflineAsrModelsPackImportDeps = {
  tauriRuntime: boolean;
  selectedHubModelId: string;
  catalogStatus: LocalAsrCatalogStatusItem[] | null;
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  setFunasrInstallMessage: (message: string) => void;
  clearPrepareModelFailure: () => void;
  refreshAsrRuntimeInfo: () => Promise<void>;
  refreshAsrModelCacheInfo: () => Promise<void>;
  restartSidecarAfterOfflineImport: () => Promise<void>;
};

export function useOfflineAsrModelsPackImport(deps: UseOfflineAsrModelsPackImportDeps) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    return () => {
      void unlistenRef.current?.();
      unlistenRef.current = null;
      if (busyRef.current) {
        void cancelOfflineAsrModelsPackImport().catch(() => {});
      }
    };
  }, []);

  const clearFailure = useCallback(() => setFailure(null), []);

  const cancelImport = useCallback(async () => {
    if (!busy) return;
    try {
      await cancelOfflineAsrModelsPackImport();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.warning(message || "无法取消导入。");
    }
  }, [busy]);

  const importPack = useCallback(async () => {
    if (!deps.tauriRuntime) {
      toast.info("导入离线模型包需在桌面应用中使用。");
      return;
    }
    setBusy(true);
    setProgress(0);
    setFailure(null);
    deps.clearPrepareModelFailure();
    try {
      const outcome = await runOfflineAsrModelsPackImportFlow({
        selectedHubModelId: deps.selectedHubModelId,
        catalogStatus: deps.catalogStatus,
        prepareModelBusy: deps.prepareModelBusy,
        prepareModelCancelling: deps.prepareModelCancelling,
        onProgressMessage: deps.setFunasrInstallMessage,
        onImportProgress: (percent) => setProgress(percent),
        registerProgressUnlisten: (unlisten) => {
          unlistenRef.current = unlisten;
        },
        onClearProgress: () => {
          deps.setFunasrInstallMessage("");
          setProgress(0);
        },
        refreshAsrRuntimeInfo: deps.refreshAsrRuntimeInfo,
        refreshAsrModelCacheInfo: deps.refreshAsrModelCacheInfo,
        retryBundledAsrSidecar: deps.restartSidecarAfterOfflineImport,
      });
      if (outcome.kind === "cancelled") {
        toast.info("已取消离线包导入。");
        return;
      }
      if (outcome.kind === "blocked") {
        toast.warning(outcome.message);
        return;
      }
      if (outcome.kind === "error") {
        setFailure(outcome.message || "导入离线模型包失败。");
        toast.error(outcome.message || "导入离线模型包失败。");
        return;
      }
      if (outcome.skippedReseed) {
        toast.success("离线模型包已在缓存中，无需重复导入。");
        return;
      }
      toast.success("离线模型包已导入，本机转写已就绪。");
    } finally {
      void unlistenRef.current?.();
      unlistenRef.current = null;
      setBusy(false);
      setProgress(0);
    }
  }, [
    deps.tauriRuntime,
    deps.selectedHubModelId,
    deps.catalogStatus,
    deps.prepareModelBusy,
    deps.prepareModelCancelling,
    deps.setFunasrInstallMessage,
    deps.clearPrepareModelFailure,
    deps.refreshAsrRuntimeInfo,
    deps.refreshAsrModelCacheInfo,
    deps.restartSidecarAfterOfflineImport,
  ]);

  const openReleasePage = useCallback(async () => {
    if (!deps.tauriRuntime) {
      toast.info("请在桌面应用中打开 Release 页面。");
      return;
    }
    try {
      const version = await fetchAppVersion();
      await p1.openOfflineAsrModelsPackReleasePage(version);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "无法打开 Release 页面。");
    }
  }, [deps.tauriRuntime]);

  return {
    offlinePackImportBusy: busy,
    offlinePackImportProgress: progress,
    offlinePackImportFailure: failure,
    importOfflineAsrModelsPack: importPack,
    cancelOfflineAsrModelsPackImport: cancelImport,
    openOfflineAsrModelsPackReleasePage: openReleasePage,
    clearOfflinePackImportFailure: clearFailure,
  };
}
