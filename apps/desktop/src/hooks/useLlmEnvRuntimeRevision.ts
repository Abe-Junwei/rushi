import { useSyncExternalStore } from "react";
import { getLlmEnvRuntimeSnapshot, subscribeLlmEnvRuntime } from "../services/llm/llmEnvRuntimeStore";

/** 与顶栏 useLlmEnvStatus 共用 store；探测/验证变更时递增，供后处理门禁刷新。 */
export function useLlmEnvRuntimeRevision(): string {
  return useSyncExternalStore(
    subscribeLlmEnvRuntime,
    () => {
      const snapshot = getLlmEnvRuntimeSnapshot();
      const detect = snapshot.ollamaDetect;
      return [
        snapshot.connectionVerifiedSeq,
        snapshot.ollamaDetectBusy ? 1 : 0,
        detect?.reachable ? 1 : 0,
        detect?.message ?? "",
      ].join("|");
    },
    () => "0|0|0|",
  );
}
