import type { AsrHealthRefreshOptions } from "../pages/useAsrHealthPoll";
import {
  readLastAsrHealthRefreshResultAfterDiagnostics,
  refreshLocalAsrDiagnostics,
} from "../pages/refreshLocalAsrDiagnostics";
import type { AsrEnvPresentation } from "./asr/asrEnvStatus";
import type { AsrPresentationOverlay } from "./environmentCapabilityPresentation";
import { buildEnvironmentCapabilityPresentation } from "./environmentCapabilityPresentation";
import { createModuleStore } from "./shared/createModuleStore";

/** R3h-I Runtime Supervisor will extend reasons with sidecar push events. */
export type EnvironmentCapabilityRefreshReason =
  | "app-init"
  | "app-focus"
  | "project-open"
  | "transcribe-preflight"
  | "manual";

export type EnvironmentCapabilityRefreshDeps = {
  refreshAsrHealth: (options?: AsrHealthRefreshOptions) => Promise<void>;
  refreshAsrModelCacheInfo?: () => Promise<unknown>;
  refreshSetupDiagnose?: (options?: {
    resetSteps?: boolean;
    touchUi?: boolean;
  }) => Promise<unknown>;
  bumpLlmRuntimeChanged?: () => void;
  refreshLlmOllamaDetect?: () => Promise<unknown>;
  bumpSttOnlineRuntimeChanged?: () => void;
  getCacheOverlay?: () => {
    desktopModelsRoot?: string | null;
    asrModelCacheBytes?: number;
  };
  /** 与 useAsrBridgeController.asrPresentation 对齐，避免 preflight 与设置页 banner 分叉。 */
  getAsrPresentationOverlay?: () => AsrPresentationOverlay | undefined;
};

export type EnvironmentCapabilitySnapshot = {
  generation: number;
  blockReason: string | null;
  presentation: AsrEnvPresentation;
  refreshedAtMs: number;
};

const FOCUS_MIN_INTERVAL_MS = 5000;
const DEFAULT_MAX_STALE_MS = 10_000;

type EnvironmentCapabilityStoreState = {
  snapshot: EnvironmentCapabilitySnapshot | null;
  registeredDeps: EnvironmentCapabilityRefreshDeps | null;
  inflight: Promise<EnvironmentCapabilitySnapshot | null> | null;
  generation: number;
  lastFocusRefreshAt: number;
};

const envCapabilityStore = createModuleStore<EnvironmentCapabilityStoreState>(() => ({
  snapshot: null,
  registeredDeps: null,
  inflight: null,
  generation: 0,
  lastFocusRefreshAt: 0,
}));

function readStore(): EnvironmentCapabilityStoreState {
  return envCapabilityStore.getState();
}

function patchStore(partial: Partial<EnvironmentCapabilityStoreState>): void {
  envCapabilityStore.setState(partial);
}

export function registerEnvironmentCapabilityRefreshDeps(
  deps: EnvironmentCapabilityRefreshDeps,
): () => void {
  patchStore({ registeredDeps: deps });
  return () => {
    if (readStore().registeredDeps === deps) {
      patchStore({ registeredDeps: null });
    }
  };
}

/** Keep registered deps fresh without re-subscribing listeners. */
export function syncEnvironmentCapabilityRefreshDeps(deps: EnvironmentCapabilityRefreshDeps): void {
  patchStore({ registeredDeps: deps });
}

export function getEnvironmentCapabilityBlockReason(): string | null {
  return readStore().snapshot?.blockReason ?? null;
}

export function resetEnvironmentCapabilityCoordinatorForTests(): void {
  patchStore({
    snapshot: null,
    registeredDeps: null,
    inflight: null,
    generation: 0,
    lastFocusRefreshAt: 0,
  });
}

function shouldRunFocusRefresh(force?: boolean): boolean {
  if (force) return true;
  const { lastFocusRefreshAt } = readStore();
  const now = Date.now();
  if (now - lastFocusRefreshAt < FOCUS_MIN_INTERVAL_MS) return false;
  patchStore({ lastFocusRefreshAt: now });
  return true;
}

function setupDiagnoseTouchUi(reason: EnvironmentCapabilityRefreshReason): boolean {
  return reason !== "transcribe-preflight" && reason !== "app-focus";
}

export async function runEnvironmentCapabilityRefresh(
  reason: EnvironmentCapabilityRefreshReason,
  deps: EnvironmentCapabilityRefreshDeps,
  options?: { touchUi?: boolean; force?: boolean },
): Promise<EnvironmentCapabilitySnapshot | null> {
  if (reason === "app-focus" && !shouldRunFocusRefresh(options?.force)) {
    return readStore().snapshot;
  }

  const existingInflight = readStore().inflight;
  if (existingInflight) return existingInflight;

  const effectiveDeps = readStore().registeredDeps ?? deps;

  const inflight = (async () => {
    try {
      if (reason === "project-open" || reason === "app-init") {
        effectiveDeps.bumpLlmRuntimeChanged?.();
        effectiveDeps.bumpSttOnlineRuntimeChanged?.();
      }

      await effectiveDeps.refreshLlmOllamaDetect?.();

      const touchUi = options?.touchUi ?? reason === "app-init";
      await refreshLocalAsrDiagnostics(
        {
          refreshAsrHealth: (healthOptions) => effectiveDeps.refreshAsrHealth(healthOptions),
          refreshAsrModelCacheInfo: effectiveDeps.refreshAsrModelCacheInfo,
          refreshSetupDiagnose: effectiveDeps.refreshSetupDiagnose,
        },
        {
          touchUi,
          setupDiagnose: {
            resetSteps: false,
            touchUi: setupDiagnoseTouchUi(reason),
          },
        },
      );

      const presentation = buildEnvironmentCapabilityPresentation({
        healthResult: readLastAsrHealthRefreshResultAfterDiagnostics(),
        cacheOverlay: effectiveDeps.getCacheOverlay?.(),
        asrOverlay: effectiveDeps.getAsrPresentationOverlay?.(),
      });

      const nextGeneration = readStore().generation + 1;
      const nextSnapshot: EnvironmentCapabilitySnapshot = {
        generation: nextGeneration,
        blockReason: presentation.blockReason,
        presentation,
        refreshedAtMs: Date.now(),
      };
      patchStore({ snapshot: nextSnapshot, generation: nextGeneration });
      return nextSnapshot;
    } finally {
      patchStore({ inflight: null });
    }
  })();

  patchStore({ inflight });
  return inflight;
}

export async function awaitEnvironmentCapabilityRefresh(options?: {
  maxStaleMs?: number;
}): Promise<EnvironmentCapabilitySnapshot | null> {
  const store = readStore();
  if (store.inflight) return store.inflight;

  const maxStaleMs = options?.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const current = store.snapshot;
  const age = current ? Date.now() - current.refreshedAtMs : Number.POSITIVE_INFINITY;
  if (age <= maxStaleMs && current) return current;

  if (!store.registeredDeps) return current;
  return runEnvironmentCapabilityRefresh("transcribe-preflight", store.registeredDeps, {
    touchUi: false,
  });
}
