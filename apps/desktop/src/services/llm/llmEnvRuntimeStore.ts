import { ollamaDetectStatus, type OllamaDetectResponse } from "../../tauri/postprocessApi";
import { LLM_CONNECTION_VERIFIED_EVENT } from "../postprocess/llmProviderCatalog";
import {
  isLocalLoopbackLlmConfig,
  markLlmConnectionVerified,
  readLlmRuntimeConfigFromStorage,
} from "../postprocess/postprocessRuntimeContract";
import { ollamaDetectReady } from "./llmEnvStatusTone";
import { resolveLlmEnvEffectiveConfig, type LlmEnvConfigDraft } from "./llmEnvStatus";
import { waitMinVisibleBusy } from "../ui/minVisibleBusy";

/** Ollama 探测 + 连接验证序号：顶栏芯片 / 设置 banner / 导出 共用真源。 */
export type LlmEnvRuntimeSnapshot = {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  connectionVerifiedSeq: number;
};

const listeners = new Set<() => void>();

let snapshot: LlmEnvRuntimeSnapshot = {
  ollamaDetect: null,
  ollamaDetectBusy: false,
  connectionVerifiedSeq: 0,
};

/** 按 refreshSeq 记录是否已为本机模式发起过探测，避免多 hook 重复触发。 */
const ensuredRefreshSeqByKey = new Map<string, number>();

let inflightDetect: Promise<OllamaDetectResponse> | null = null;

function publish(): void {
  for (const listener of listeners) listener();
}

export function getLlmEnvRuntimeSnapshot(): LlmEnvRuntimeSnapshot {
  return snapshot;
}

export function subscribeLlmEnvRuntime(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function bumpLlmEnvConnectionVerifiedSeq(): void {
  snapshot = { ...snapshot, connectionVerifiedSeq: snapshot.connectionVerifiedSeq + 1 };
  publish();
}

function ensureKey(refreshSeq: number, configDraft?: LlmEnvConfigDraft | null): string {
  if (!configDraft) return `persisted:${refreshSeq}`;
  const effective = resolveLlmEnvEffectiveConfig(configDraft);
  return `${refreshSeq}:${effective.providerId}:${effective.baseUrl}:${effective.model}`;
}

export function ensureLlmOllamaDetect(args: {
  refreshSeq: number;
  configDraft?: LlmEnvConfigDraft | null;
}): void {
  const key = ensureKey(args.refreshSeq, args.configDraft);
  if (ensuredRefreshSeqByKey.get(key) === args.refreshSeq && snapshot.ollamaDetect !== null) {
    return;
  }
  if (snapshot.ollamaDetectBusy && inflightDetect) return;
  ensuredRefreshSeqByKey.set(key, args.refreshSeq);
  void refreshLlmOllamaDetect(args);
}

export async function refreshLlmOllamaDetect(args?: {
  configDraft?: LlmEnvConfigDraft | null;
}): Promise<OllamaDetectResponse> {
  if (inflightDetect) return inflightDetect;

  inflightDetect = (async () => {
    const startedAt = Date.now();
    snapshot = { ...snapshot, ollamaDetectBusy: true };
    publish();

    const cfg = args?.configDraft
      ? resolveLlmEnvEffectiveConfig(args.configDraft)
      : readLlmRuntimeConfigFromStorage();
    const probeModel = cfg.model.trim() || readLlmRuntimeConfigFromStorage().model;

    try {
      const out = await ollamaDetectStatus({ model: probeModel });
      await waitMinVisibleBusy(startedAt);
      snapshot = { ...snapshot, ollamaDetect: out, ollamaDetectBusy: false };
      publish();
      if (out.reachable && isLocalLoopbackLlmConfig(cfg) && ollamaDetectReady(out)) {
        markLlmConnectionVerified(cfg);
      }
      return out;
    } catch (e) {
      const out: OllamaDetectResponse = {
        reachable: false,
        modelCount: 0,
        hasQwen25_7b: false,
        message: e instanceof Error ? e.message : String(e),
      };
      await waitMinVisibleBusy(startedAt);
      snapshot = { ...snapshot, ollamaDetect: out, ollamaDetectBusy: false };
      publish();
      return out;
    } finally {
      inflightDetect = null;
    }
  })();

  return inflightDetect;
}

/** 测试专用：重置 store */
export function resetLlmEnvRuntimeStoreForTests(): void {
  snapshot = {
    ollamaDetect: null,
    ollamaDetectBusy: false,
    connectionVerifiedSeq: 0,
  };
  ensuredRefreshSeqByKey.clear();
  inflightDetect = null;
  publish();
}

if (typeof window !== "undefined") {
  window.addEventListener(LLM_CONNECTION_VERIFIED_EVENT, bumpLlmEnvConnectionVerifiedSeq);
}
