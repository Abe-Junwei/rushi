import { useEffect, useRef } from "react";
import { isTauriRuntime } from "../config/env";
import { postAsrModelUnload } from "../services/asr/asrModelUnload";

/** Idle grace period before unload — avoids thrash on rapid file preview switches. */
export const ASR_MODEL_UNLOAD_IDLE_DELAY_MS = 3000;

type UseAsrModelUnloadOnFileSwitchOptions = {
  currentFileId: string | null;
  busy: boolean;
  batchTranscribeRunning: boolean;
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  refreshAsrHealth: () => Promise<void>;
};

function shouldSkipUnload(options: UseAsrModelUnloadOnFileSwitchOptions): boolean {
  return (
    options.busy ||
    options.batchTranscribeRunning ||
    options.prepareModelBusy ||
    options.prepareModelCancelling
  );
}

/** B2: unload sidecar FunASR RAM on idle file switch (incl. back to Project Hub). */
export function useAsrModelUnloadOnFileSwitch(options: UseAsrModelUnloadOnFileSwitchOptions): void {
  const prevFileIdRef = useRef<string | null | undefined>(undefined);
  const skipNextRef = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const prev = prevFileIdRef.current;
    const next = options.currentFileId;
    prevFileIdRef.current = next;

    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    if (prev === next) return;
    if (!isTauriRuntime()) return;
    if (shouldSkipUnload(options)) return;

    const timer = setTimeout(() => {
      const live = optionsRef.current;
      if (shouldSkipUnload(live)) return;
      void (async () => {
        await postAsrModelUnload();
        await live.refreshAsrHealth();
      })();
    }, ASR_MODEL_UNLOAD_IDLE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    options.currentFileId,
    options.busy,
    options.batchTranscribeRunning,
    options.prepareModelBusy,
    options.prepareModelCancelling,
    options.refreshAsrHealth,
  ]);
}
