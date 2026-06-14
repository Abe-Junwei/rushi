/** Curated FunASR hub models (R3g-A); keep in sync with `services/asr/rushi_asr/model_catalog.py`. */

export const LOCAL_ASR_HUB_MODEL_STORAGE_KEY = "rushi.localAsr.hubModelId";

/** Removed from catalog; migrated to {@link DEFAULT_LOCAL_ASR_HUB_MODEL_ID} on read. */
export const DEPRECATED_LOCAL_ASR_HUB_MODEL_IDS = ["iic/SenseVoiceSmall"] as const;

export interface LocalAsrCatalogEntry {
  catalogId: string;
  label: string;
  hubModelId: string;
  description: string;
  diskHint: string;
  recommendLongAudio: boolean;
}

export const LOCAL_ASR_MODEL_CATALOG: readonly LocalAsrCatalogEntry[] = [
  {
    catalogId: "paraformer-long-vad-punc",
    label: "Paraformer 长音频（推荐转写）",
    hubModelId:
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    description: "带 VAD、标点与时间戳，适合需要多语段的长音频。",
    diskHint: "约 1–2 GB",
    recommendLongAudio: true,
  },
] as const;

export const DEFAULT_LOCAL_ASR_HUB_MODEL_ID = LOCAL_ASR_MODEL_CATALOG[0].hubModelId;

export function migrateDeprecatedHubModelId(hubModelId: string): string {
  const raw = hubModelId.trim();
  if ((DEPRECATED_LOCAL_ASR_HUB_MODEL_IDS as readonly string[]).includes(raw)) {
    return DEFAULT_LOCAL_ASR_HUB_MODEL_ID;
  }
  return raw;
}

export function catalogEntryForHub(hubModelId: string): LocalAsrCatalogEntry | undefined {
  const hub = migrateDeprecatedHubModelId(hubModelId);
  return LOCAL_ASR_MODEL_CATALOG.find((e) => e.hubModelId === hub);
}

export function resolveLocalAsrHubModelId(preferred: string | null | undefined): string {
  const raw = migrateDeprecatedHubModelId(preferred ?? "");
  if (raw && catalogEntryForHub(raw)) return raw;
  if (raw.includes("/")) return raw;
  return DEFAULT_LOCAL_ASR_HUB_MODEL_ID;
}

export interface LocalAsrCatalogStatusItem {
  catalogId: string;
  label: string;
  hubModelId: string;
  description: string;
  diskHint: string;
  recommendLongAudio: boolean;
  cached: boolean;
  active: boolean;
  readyForTranscribe: boolean;
}

export function parseCatalogStatusFromHealth(data: unknown): LocalAsrCatalogStatusItem[] | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).local_asr_model_catalog;
  return parseCatalogStatusItems(raw);
}

export function parseCatalogStatusFromEndpoint(data: unknown): LocalAsrCatalogStatusItem[] | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as Record<string, unknown>).items;
  return parseCatalogStatusItems(raw);
}

function parseCatalogStatusItems(raw: unknown): LocalAsrCatalogStatusItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: LocalAsrCatalogStatusItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const j = row as Record<string, unknown>;
    const hubModelId = typeof j.hub_model_id === "string" ? j.hub_model_id : "";
    if (!hubModelId) continue;
    out.push({
      catalogId: typeof j.catalog_id === "string" ? j.catalog_id : hubModelId,
      label: typeof j.label === "string" ? j.label : hubModelId,
      hubModelId,
      description: typeof j.description === "string" ? j.description : "",
      diskHint: typeof j.disk_hint === "string" ? j.disk_hint : "",
      recommendLongAudio: j.recommend_long_audio === true,
      cached: j.cached === true,
      active: j.active === true,
      readyForTranscribe: j.ready_for_transcribe === true,
    });
  }
  return out.length > 0 ? out : null;
}

/** True when /health includes R3g-A catalog (rebuilt sidecar + fresh process on :8741). */
export function sidecarSupportsModelCatalog(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return Array.isArray((data as Record<string, unknown>).local_asr_model_catalog);
}

/** True when GET / root documents R3g catalog (new sidecar). */
export function sidecarSupportsModelCatalogFromRoot(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const j = data as Record<string, unknown>;
  return typeof j.model_catalog === "string";
}

/** True when GET / documents prepare-cancel (Paraformer punc prepare + Q-R3g-3). */
export function sidecarSupportsPuncPrepareFromRoot(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const raw = (data as Record<string, unknown>).prepare_cancel;
  return typeof raw === "string" && raw.includes("/v1/models/prepare-cancel");
}

/** True when GET / documents R3e-C async transcribe job API. */
export function sidecarSupportsTranscribeAsyncFromRoot(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const raw = (data as Record<string, unknown>).transcribe_async;
  return typeof raw === "string" && raw.includes("/v1/transcribe/async");
}

export function hubModelNeedsPuncPrepare(hubModelId: string): boolean {
  const mid = migrateDeprecatedHubModelId(hubModelId).toLowerCase();
  if (mid.includes("sensevoice") || mid.includes("fun-asr-nano") || mid.includes("qwen")) {
    return false;
  }
  if (mid.includes("paraformer") || mid.includes("vad-punc") || mid.includes("vad_punc")) {
    return true;
  }
  return false;
}

export function sidecarSupportsModelCatalogAny(
  healthJson: unknown,
  rootJson: unknown,
): boolean {
  return sidecarSupportsModelCatalog(healthJson) || sidecarSupportsModelCatalogFromRoot(rootJson);
}

export function readStoredLocalAsrHubModelId(): string {
  try {
    return resolveLocalAsrHubModelId(localStorage.getItem(LOCAL_ASR_HUB_MODEL_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCAL_ASR_HUB_MODEL_ID;
  }
}

export type LocalAsrTranscribeReadyInput = {
  asrHealth: "checking" | "ok" | "error";
  asrCaps: {
    ffmpeg_ok?: boolean;
    funasr_model_id?: string | null;
    funasr_loaded_model_id?: string | null;
    funasr_default_model_cached?: boolean;
    funasr_active_model_cached?: boolean;
    funasr_required_models_cached?: boolean;
    ready_for_transcribe?: boolean;
  } | null;
  selectedHubModelId?: string | null;
  catalogStatus?: LocalAsrCatalogStatusItem[] | null;
};

/** D1=D2 aligned + active SKU ready (R3-STATE); never treat global D5 as「所选模型可转写」. */
export function computeLocalAsrTranscribeReady(input: LocalAsrTranscribeReadyInput): {
  ready: boolean;
  sidecarMatchesSelection: boolean;
} {
  const { asrHealth, asrCaps } = input;
  if (asrHealth !== "ok" || !asrCaps) {
    return { ready: false, sidecarMatchesSelection: false };
  }
  const selected = resolveLocalAsrHubModelId(
    input.selectedHubModelId ?? readStoredLocalAsrHubModelId(),
  );
  const sidecarHub = asrCaps.funasr_model_id ?? null;
  const sidecarMatchesSelection = selectedModelMatchesSidecar(selected, sidecarHub);
  if (!sidecarMatchesSelection) {
    return { ready: false, sidecarMatchesSelection: false };
  }
  if (!sidecarMemoryModelMatchesConfig(asrCaps)) {
    return { ready: false, sidecarMatchesSelection: true };
  }
  const view = buildLocalAsrCatalogView(asrCaps, input.catalogStatus ?? null, selected);
  const prepare = selectedModelPrepareState(view, selected, sidecarHub);
  const ready =
    prepare.readyForTranscribe ||
    (asrCaps.ready_for_transcribe === true && sidecarMatchesSelection);
  return { ready, sidecarMatchesSelection };
}

function selectedModelMatchesSidecar(
  selectedHubModelId: string,
  sidecarHubModelId: string | null | undefined,
): boolean {
  if (!sidecarHubModelId) return false;
  return (
    migrateDeprecatedHubModelId(selectedHubModelId) ===
    migrateDeprecatedHubModelId(sidecarHubModelId)
  );
}

/** True when sidecar memory holds the same hub id as configured (D1). Null loaded = not yet loaded. */
function sidecarMemoryModelMatchesConfig(
  asrCaps: {
    funasr_model_id?: string | null;
    funasr_loaded_model_id?: string | null;
  } | null,
): boolean {
  const configured = asrCaps?.funasr_model_id;
  if (!configured) return true;
  const loaded = asrCaps?.funasr_loaded_model_id;
  if (loaded == null || loaded === "") return true;
  return (
    migrateDeprecatedHubModelId(loaded) === migrateDeprecatedHubModelId(configured)
  );
}

export function selectedModelPrepareState(
  catalogView: LocalAsrCatalogStatusItem[],
  selectedHubModelId: string,
  sidecarHubModelId: string | null | undefined,
): {
  cached: boolean;
  readyForTranscribe: boolean;
  sidecarMatchesSelection: boolean;
} {
  const selected = catalogView.find((item) => item.hubModelId === selectedHubModelId);
  const sidecarMatchesSelection = selectedModelMatchesSidecar(selectedHubModelId, sidecarHubModelId);
  return {
    cached: selected?.cached ?? false,
    readyForTranscribe: sidecarMatchesSelection && (selected?.readyForTranscribe ?? false),
    sidecarMatchesSelection,
  };
}

/** Always list curated SKUs; merge server status and /health caps for cache hints. */
export function buildLocalAsrCatalogView(
  caps: {
    funasr_model_id?: string | null;
    funasr_default_model_cached?: boolean;
    funasr_active_model_cached?: boolean;
    funasr_required_models_cached?: boolean;
  } | null,
  serverStatus: LocalAsrCatalogStatusItem[] | null,
  selectedHubModelId: string,
): LocalAsrCatalogStatusItem[] {
  const activeHub = migrateDeprecatedHubModelId(caps?.funasr_model_id ?? selectedHubModelId);
  return LOCAL_ASR_MODEL_CATALOG.map((entry) => {
    const fromServer = serverStatus?.find((s) => s.hubModelId === entry.hubModelId);
    const active = entry.hubModelId === activeHub;
    let cached = fromServer?.cached ?? false;
    let readyForTranscribe = fromServer?.readyForTranscribe ?? false;

    if (entry.hubModelId === DEFAULT_LOCAL_ASR_HUB_MODEL_ID && caps?.funasr_default_model_cached === true) {
      cached = true;
    }
    if (active && caps?.funasr_active_model_cached === true) {
      cached = true;
    }
    if (active && caps?.funasr_model_id && caps?.funasr_required_models_cached === true) {
      cached = true;
      readyForTranscribe = true;
    }

    if (fromServer) {
      return { ...fromServer, cached, active, readyForTranscribe };
    }

    return {
      catalogId: entry.catalogId,
      label: entry.label,
      hubModelId: entry.hubModelId,
      description: entry.description,
      diskHint: entry.diskHint,
      recommendLongAudio: entry.recommendLongAudio,
      cached,
      active,
      readyForTranscribe,
    };
  });
}
