import type { LocalTranscribePreflight } from "./useTranscribeJobController";
import { useProjectLifecycleWiring } from "./useProjectLifecycleWiring";
import type { ProjectLifecycleApi } from "./ProjectLifecycleApi";

export type { ProjectLifecycleApi } from "./ProjectLifecycleApi";
export type { BusyReason } from "./useProjectCrudController";
export type { LocalTranscribePreflight };

export function useProjectLifecycleController(
  localTranscribePreflight: LocalTranscribePreflight = () => null,
  sttOnlineRuntimeEpoch = 0,
  softWakeBeforeLocalTranscribe?: () => Promise<void>,
): ProjectLifecycleApi {
  return useProjectLifecycleWiring(
    localTranscribePreflight,
    sttOnlineRuntimeEpoch,
    softWakeBeforeLocalTranscribe,
  );
}
