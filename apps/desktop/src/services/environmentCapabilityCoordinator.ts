import type { AsrHealthRefreshOptions } from "../pages/useAsrHealthPoll";
import {
  readLastAsrHealthRefreshResultAfterDiagnostics,
  refreshLocalAsrDiagnostics,
} from "../pages/refreshLocalAsrDiagnostics";
import type { AsrEnvPresentation } from "./asr/asrEnvStatus";
import type { AsrPresentationOverlay } from "./environmentCapabilityPresentation";
import { buildEnvironmentCapabilityPresentation } from "./environmentCapabilityPresentation";

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

let registeredDeps: EnvironmentCapabilityRefreshDeps | null = null;
let inflight: Promise<EnvironmentCapabilitySnapshot | null> | null = null;
let latestSnapshot: EnvironmentCapabilitySnapshot | null = null;
let generation = 0;
let lastFocusRefreshAt = 0;

const listeners = new Set<(snapshot: EnvironmentCapabilitySnapshot | null) => void>();

function publish(snapshot: EnvironmentCapabilitySnapshot | null): void {
  for (const listener of listeners) listener(snapshot);
}

export function registerEnvironmentCapabilityRefreshDeps(
  deps: EnvironmentCapabilityRefreshDeps,
): () => void {
  registeredDeps = deps;
  return () => {
    if (registeredDeps === deps) registeredDeps = null;
  };
}

/** Keep registered deps fresh without re-subscribing listeners. */
export function syncEnvironmentCapabilityRefreshDeps(deps: EnvironmentCapabilityRefreshDeps): void {
  registeredDeps = deps;
}

export function getEnvironmentCapabilityBlockReason(): string | null {
  return latestSnapshot?.blockReason ?? null;
}

export function resetEnvironmentCapabilityCoordinatorForTests(): void {
  registeredDeps = null;
  inflight = null;
  latestSnapshot = null;
  generation = 0;
  lastFocusRefreshAt = 0;
  listeners.clear();
}

function shouldRunFocusRefresh(force?: boolean): boolean {
  if (force) return true;
  const now = Date.now();
  if (now - lastFocusRefreshAt < FOCUS_MIN_INTERVAL_MS) return false;
  lastFocusRefreshAt = now;
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
    return latestSnapshot;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      if (reason === "project-open" || reason === "app-init") {
        deps.bumpLlmRuntimeChanged?.();
        deps.bumpSttOnlineRuntimeChanged?.();
      }

      await deps.refreshLlmOllamaDetect?.();

      const touchUi = options?.touchUi ?? reason === "app-init";
      await refreshLocalAsrDiagnostics(
        {
          refreshAsrHealth: (healthOptions) => deps.refreshAsrHealth(healthOptions),
          refreshAsrModelCacheInfo: deps.refreshAsrModelCacheInfo,
          refreshSetupDiagnose: deps.refreshSetupDiagnose,
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
        cacheOverlay: deps.getCacheOverlay?.(),
        asrOverlay: deps.getAsrPresentationOverlay?.(),
      });

      latestSnapshot = {
        generation: ++generation,
        blockReason: presentation.blockReason,
        presentation,
        refreshedAtMs: Date.now(),
      };
      publish(latestSnapshot);
      return latestSnapshot;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export async function awaitEnvironmentCapabilityRefresh(options?: {
  maxStaleMs?: number;
}): Promise<EnvironmentCapabilitySnapshot | null> {
  if (inflight) return inflight;

  const maxStaleMs = options?.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const age = latestSnapshot ? Date.now() - latestSnapshot.refreshedAtMs : Number.POSITIVE_INFINITY;
  if (age <= maxStaleMs && latestSnapshot) return latestSnapshot;

  if (!registeredDeps) return latestSnapshot;
  return runEnvironmentCapabilityRefresh("transcribe-preflight", registeredDeps, {
    touchUi: false,
  });
}
