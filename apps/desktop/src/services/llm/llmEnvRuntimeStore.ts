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
import { createModuleStore } from "../shared/createModuleStore";

/** Ollama 探测 + 连接验证序号：顶栏芯片 / 设置 banner / 导出 共用真源。 */
export type LlmEnvRuntimeSnapshot = {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  connectionVerifiedSeq: number;
};

const initialSnapshot: LlmEnvRuntimeSnapshot = {
  ollamaDetect: null,
  ollamaDetectBusy: false,
  connectionVerifiedSeq: 0,
};

const llmEnvRuntimeStore = createModuleStore<LlmEnvRuntimeSnapshot>(() => ({ ...initialSnapshot }));

/** 按 refreshSeq 记录是否已为本机模式发起过探测，避免多 hook 重复触发。 */
const ensuredRefreshSeqByKey = new Map<string, number>();

let inflightDetect: Promise<OllamaDetectResponse> | null = null;

function setSnapshot(partial: Partial<LlmEnvRuntimeSnapshot>): void {
  llmEnvRuntimeStore.setState((prev) => ({ ...prev, ...partial }));
}

export function getLlmEnvRuntimeSnapshot(): LlmEnvRuntimeSnapshot {
  return llmEnvRuntimeStore.getState();
}

export function subscribeLlmEnvRuntime(onStoreChange: () => void): () => void {
  return llmEnvRuntimeStore.subscribe(onStoreChange);
}

function bumpLlmEnvConnectionVerifiedSeq(): void {
  setSnapshot({ connectionVerifiedSeq: getLlmEnvRuntimeSnapshot().connectionVerifiedSeq + 1 });
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
  const snapshot = getLlmEnvRuntimeSnapshot();
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
    setSnapshot({ ollamaDetectBusy: true });

    const cfg = args?.configDraft
      ? resolveLlmEnvEffectiveConfig(args.configDraft)
      : readLlmRuntimeConfigFromStorage();
    const probeModel = cfg.model.trim() || readLlmRuntimeConfigFromStorage().model;

    try {
      const out = await ollamaDetectStatus({ model: probeModel });
      await waitMinVisibleBusy(startedAt);
      setSnapshot({ ollamaDetect: out, ollamaDetectBusy: false });
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
      setSnapshot({ ollamaDetect: out, ollamaDetectBusy: false });
      return out;
    } finally {
      inflightDetect = null;
    }
  })();

  return inflightDetect;
}

/** 测试专用：重置 store */
export function resetLlmEnvRuntimeStoreForTests(): void {
  llmEnvRuntimeStore.setState({ ...initialSnapshot });
  ensuredRefreshSeqByKey.clear();
  inflightDetect = null;
}

if (typeof window !== "undefined") {
  window.addEventListener(LLM_CONNECTION_VERIFIED_EVENT, bumpLlmEnvConnectionVerifiedSeq);
}
