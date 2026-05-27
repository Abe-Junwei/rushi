import { useCallback, useEffect, useMemo, useState } from "react";
import { asrBaseUrl, asrHealthUrl, isTauriRuntime } from "../config/env";
import {
  DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
  LOCAL_ASR_HUB_MODEL_STORAGE_KEY,
  LOCAL_ASR_MODEL_CATALOG,
  catalogEntryForHub,
  sidecarSupportsModelCatalogFromRoot,
  sidecarSupportsModelCatalogAny,
  sidecarSupportsPuncPrepareFromRoot,
  parseCatalogStatusFromEndpoint,
  parseCatalogStatusFromHealth,
  resolveLocalAsrHubModelId,
  type LocalAsrCatalogStatusItem,
} from "../services/asr/localAsrModelCatalog";
import * as p1 from "../tauri/projectApi";

function readStoredHubModelId(): string | null {
  try {
    const v = localStorage.getItem(LOCAL_ASR_HUB_MODEL_STORAGE_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredHubModelId(hubModelId: string): void {
  try {
    localStorage.setItem(LOCAL_ASR_HUB_MODEL_STORAGE_KEY, hubModelId);
  } catch {
    /* ignore */
  }
}

export interface LocalAsrModelCatalogApi {
  selectedHubModelId: string;
  selectedEntry: (typeof LOCAL_ASR_MODEL_CATALOG)[number];
  catalogStatus: LocalAsrCatalogStatusItem[] | null;
  sidecarCatalogCapable: boolean;
  /** False when loopback sidecar lacks prepare-cancel / punc prepare (old PyInstaller). */
  sidecarPuncPrepareCapable: boolean;
  applyBusy: boolean;
  applyMessage: string;
  setSelectedHubModelId: (hubModelId: string) => void;
  applySelectedModel: () => Promise<void>;
  syncCatalogFromHealth: (healthJson: unknown, rootJson?: unknown) => void;
  refreshCatalogFromSidecar: () => Promise<void>;
  bootstrapFromTauri: () => Promise<void>;
}

export function useLocalAsrModelCatalog(
  refreshAsrRuntimeInfo: () => Promise<void>,
): LocalAsrModelCatalogApi {
  const tauriRuntime = isTauriRuntime();
  const [selectedHubModelId, setSelectedHubModelIdState] = useState(() =>
    resolveLocalAsrHubModelId(readStoredHubModelId()),
  );
  const [catalogStatus, setCatalogStatus] = useState<LocalAsrCatalogStatusItem[] | null>(null);
  const [sidecarCatalogCapable, setSidecarCatalogCapable] = useState(false);
  const [sidecarPuncPrepareCapable, setSidecarPuncPrepareCapable] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");

  const selectedEntry = useMemo(
    () => catalogEntryForHub(selectedHubModelId) ?? LOCAL_ASR_MODEL_CATALOG[0],
    [selectedHubModelId],
  );

  const setSelectedHubModelId = useCallback((hubModelId: string) => {
    const resolved = resolveLocalAsrHubModelId(hubModelId);
    setSelectedHubModelIdState(resolved);
    writeStoredHubModelId(resolved);
  }, []);

  const syncCatalogFromHealth = useCallback((healthJson: unknown, rootJson?: unknown) => {
    const root = rootJson ?? null;
    setSidecarCatalogCapable(sidecarSupportsModelCatalogAny(healthJson, root));
    setSidecarPuncPrepareCapable(sidecarSupportsPuncPrepareFromRoot(root));
    const parsed = parseCatalogStatusFromHealth(healthJson);
    if (parsed) setCatalogStatus(parsed);
  }, []);

  const probeSidecarRoot = useCallback(async () => {
    if (!isTauriRuntime()) return null;
    const base = asrBaseUrl().replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  }, []);

  const refreshCatalogFromSidecar = useCallback(async () => {
    if (!isTauriRuntime()) return;
    const base = asrBaseUrl().replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/v1/models/catalog`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data: unknown = await res.json();
      const parsed = parseCatalogStatusFromEndpoint(data);
      if (parsed) {
        setCatalogStatus(parsed);
        setSidecarCatalogCapable(true);
      }
      const root = await probeSidecarRoot();
      if (root) {
        setSidecarPuncPrepareCapable(sidecarSupportsPuncPrepareFromRoot(root));
      }
    } catch {
      /* sidecar may be older build without catalog endpoint */
    }
  }, [probeSidecarRoot]);

  const bootstrapFromTauri = useCallback(async () => {
    if (!tauriRuntime) return;
    try {
      const pref = await p1.getLocalAsrHubModelPref();
      if (pref?.trim()) {
        setSelectedHubModelId(pref.trim());
      }
    } catch {
      /* ignore */
    }
  }, [tauriRuntime, setSelectedHubModelId]);

  useEffect(() => {
    void bootstrapFromTauri();
  }, [bootstrapFromTauri]);

  const applySelectedModel = useCallback(async () => {
    const hub = resolveLocalAsrHubModelId(selectedHubModelId);
    writeStoredHubModelId(hub);
    if (!tauriRuntime) {
      setApplyMessage("浏览器预览无法切换侧车模型，请在桌面应用中操作。");
      return;
    }
    setApplyBusy(true);
    setApplyMessage("正在重启内置侧车并应用所选模型…");
    try {
      await p1.setLocalAsrHubModelPref(hub);
      setApplyMessage("已写入模型偏好，正在重启侧车…");
      await refreshAsrRuntimeInfo();
      const root = await probeSidecarRoot();
      if (root) {
        if (sidecarSupportsModelCatalogFromRoot(root)) {
          setSidecarCatalogCapable(true);
        }
        setSidecarPuncPrepareCapable(sidecarSupportsPuncPrepareFromRoot(root));
      }
      await refreshCatalogFromSidecar();
      try {
        const healthRes = await fetch(asrHealthUrl(), { signal: AbortSignal.timeout(8000) });
        if (healthRes.ok) {
          const hj = (await healthRes.json()) as Record<string, unknown>;
          const sidecarModel =
            typeof hj.funasr_model_id === "string" ? hj.funasr_model_id.trim() : "";
          if (sidecarModel && sidecarModel !== hub) {
            const label = catalogEntryForHub(hub)?.label ?? hub;
            setApplyMessage(
              `侧车仍在运行 ${sidecarModel}，尚未切换到 ${label}。请再点「应用并重启侧车」，或使用 ASR 状态区的「重试内置侧车」。`,
            );
            return;
          }
        }
      } catch {
        /* ignore verify errors */
      }
      setApplyMessage("");
    } catch (e) {
      setApplyMessage(
        `应用模型失败：${e instanceof Error ? e.message : String(e)}。可尝试「重试内置侧车」。`,
      );
    } finally {
      setApplyBusy(false);
    }
  }, [probeSidecarRoot, refreshAsrRuntimeInfo, refreshCatalogFromSidecar, selectedHubModelId, tauriRuntime]);

  return {
    selectedHubModelId,
    selectedEntry,
    catalogStatus,
    sidecarCatalogCapable,
    sidecarPuncPrepareCapable,
    applyBusy,
    applyMessage,
    setSelectedHubModelId,
    applySelectedModel,
    syncCatalogFromHealth,
    refreshCatalogFromSidecar,
    bootstrapFromTauri,
  };
}

export { DEFAULT_LOCAL_ASR_HUB_MODEL_ID };
