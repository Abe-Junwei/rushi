import { useCallback, useEffect, useMemo, useState } from "react";
import { asrBaseUrl, isTauriRuntime } from "../config/env";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import {
  normalizeLocalAsrRecognitionLanguage,
  readStoredLocalAsrRecognitionLanguage,
  writeStoredLocalAsrRecognitionLanguage,
  type LocalAsrRecognitionLanguage,
} from "../services/asr/localAsrRecognitionLanguage";
import { applyHubModelToSidecar } from "../services/asr/localAsrSetupModelStep";
import { toast } from "../services/ui/toast";
import {
  DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
  LOCAL_ASR_HUB_MODEL_STORAGE_KEY,
  LOCAL_ASR_MODEL_CATALOG,
  catalogEntryForHub,
  sidecarSupportsModelCatalogFromRoot,
  sidecarSupportsModelCatalogAny,
  sidecarSupportsPuncPrepareFromRoot,
  sidecarSupportsTranscribeAsyncFromRoot,
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
  /** False when loopback sidecar lacks R3e-C ``/v1/transcribe/async`` (stale PyInstaller). */
  sidecarAsyncTranscribeCapable: boolean;
  applyBusy: boolean;
  applyMessage: string;
  /** False when `RUSHI_SKIP_BUNDLED_ASR=1` (npm run desktop:dev). */
  bundledSidecarManaged: boolean;
  setSelectedHubModelId: (hubModelId: string) => void;
  recognitionLanguage: LocalAsrRecognitionLanguage;
  setRecognitionLanguage: (language: LocalAsrRecognitionLanguage) => void;
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
  const [sidecarAsyncTranscribeCapable, setSidecarAsyncTranscribeCapable] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [bundledSidecarManaged, setBundledSidecarManaged] = useState(true);
  const [recognitionLanguage, setRecognitionLanguageState] = useState<LocalAsrRecognitionLanguage>(
    () => readStoredLocalAsrRecognitionLanguage(),
  );

  const selectedEntry = useMemo(
    () => catalogEntryForHub(selectedHubModelId) ?? LOCAL_ASR_MODEL_CATALOG[0],
    [selectedHubModelId],
  );

  const setSelectedHubModelId = useCallback((hubModelId: string) => {
    const resolved = resolveLocalAsrHubModelId(hubModelId);
    setSelectedHubModelIdState(resolved);
    writeStoredHubModelId(resolved);
  }, []);

  const setRecognitionLanguage = useCallback((language: LocalAsrRecognitionLanguage) => {
    const resolved = normalizeLocalAsrRecognitionLanguage(language);
    setRecognitionLanguageState(resolved);
    writeStoredLocalAsrRecognitionLanguage(resolved);
  }, []);

  const syncCatalogFromHealth = useCallback((healthJson: unknown, rootJson?: unknown) => {
    const root = rootJson ?? null;
    setSidecarCatalogCapable(sidecarSupportsModelCatalogAny(healthJson, root));
    setSidecarPuncPrepareCapable(sidecarSupportsPuncPrepareFromRoot(root));
    setSidecarAsyncTranscribeCapable(sidecarSupportsTranscribeAsyncFromRoot(root));
    const parsed = parseCatalogStatusFromHealth(healthJson);
    if (parsed) setCatalogStatus(parsed);
  }, []);

  const probeSidecarRoot = useCallback(async () => {
    if (!isTauriRuntime()) return null;
    const base = asrBaseUrl().replace(/\/+$/, "");
    try {
      const res = await loopbackFetch(`${base}/`, { signal: AbortSignal.timeout(5000) });
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
      const res = await loopbackFetch(`${base}/v1/models/catalog`, {
        signal: AbortSignal.timeout(8000),
      });
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
        setSidecarAsyncTranscribeCapable(sidecarSupportsTranscribeAsyncFromRoot(root));
      }
    } catch {
      /* sidecar may be older build without catalog endpoint */
    }
  }, [probeSidecarRoot]);

  const bootstrapFromTauri = useCallback(async () => {
    if (!tauriRuntime) return;
    try {
      const [pref, langPref, managed] = await Promise.all([
        p1.getLocalAsrHubModelPref(),
        p1.getLocalAsrRecognitionLanguagePref(),
        p1.asrAppManagesBundledSidecar().catch(() => true),
      ]);
      setBundledSidecarManaged(managed);
      if (pref?.trim()) {
        setSelectedHubModelId(pref.trim());
      }
      setRecognitionLanguage(normalizeLocalAsrRecognitionLanguage(langPref));
    } catch {
      /* ignore */
    }
  }, [tauriRuntime, setSelectedHubModelId, setRecognitionLanguage]);

  useEffect(() => {
    void bootstrapFromTauri();
  }, [bootstrapFromTauri]);

  const applySelectedModel = useCallback(async () => {
    const hub = resolveLocalAsrHubModelId(selectedHubModelId);
    writeStoredHubModelId(hub);
    const selectionCtx = {
      selectedHubModelId: hub,
      catalogStatus,
      recognitionLanguage,
      sidecarAsyncTranscribeCapable,
    };
    if (!tauriRuntime) {
      toast.warning("浏览器预览无法切换侧车模型，请在桌面应用中操作。");
      return;
    }
    setApplyBusy(true);
    setApplyMessage("");
    try {
      const result = await withApplyTimeout(
        applyHubModelToSidecar(selectionCtx, (msg) => {
          toast.info(msg, 4_000);
        }),
        120_000,
        "应用模型超时（120 秒）。请点「重试内置侧车」或重新运行 npm run desktop:dev。",
      );
      setApplyMessage("");
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      await refreshAsrRuntimeInfo();
      const root = await probeSidecarRoot();
      if (root) {
        if (sidecarSupportsModelCatalogFromRoot(root)) {
          setSidecarCatalogCapable(true);
        }
        setSidecarPuncPrepareCapable(sidecarSupportsPuncPrepareFromRoot(root));
        setSidecarAsyncTranscribeCapable(sidecarSupportsTranscribeAsyncFromRoot(root));
      }
      await refreshCatalogFromSidecar();
    } catch (e) {
      setApplyMessage("");
      toast.error(
        `应用模型失败：${e instanceof Error ? e.message : String(e)}。可尝试「重试内置侧车」。`,
      );
    } finally {
      setApplyBusy(false);
    }
  }, [
    catalogStatus,
    probeSidecarRoot,
    recognitionLanguage,
    sidecarAsyncTranscribeCapable,
    refreshAsrRuntimeInfo,
    refreshCatalogFromSidecar,
    selectedHubModelId,
    tauriRuntime,
  ]);

  return {
    selectedHubModelId,
    selectedEntry,
    catalogStatus,
    sidecarCatalogCapable,
    sidecarPuncPrepareCapable,
    sidecarAsyncTranscribeCapable,
    applyBusy,
    applyMessage,
    bundledSidecarManaged,
    setSelectedHubModelId,
    recognitionLanguage,
    setRecognitionLanguage,
    applySelectedModel,
    syncCatalogFromHealth,
    refreshCatalogFromSidecar,
    bootstrapFromTauri,
  };
}

async function withApplyTimeout(
  promise: Promise<{ ok: boolean; message: string; needsManualSidecarRestart?: boolean }>,
  ms: number,
  timeoutMessage: string,
): Promise<{ ok: boolean; message: string; needsManualSidecarRestart?: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<{ ok: false; message: string; needsManualSidecarRestart: true }>((resolve) => {
        timer = setTimeout(
          () => resolve({ ok: false, message: timeoutMessage, needsManualSidecarRestart: true }),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { DEFAULT_LOCAL_ASR_HUB_MODEL_ID };
