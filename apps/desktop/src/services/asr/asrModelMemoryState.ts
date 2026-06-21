import type { AsrHealthCapabilities } from "../../tauri/projectApi";

/** D8: FunASR weights resident in sidecar RAM vs disk-only. */
export type ModelMemoryState = "disk" | "loaded" | "unloading";

export function deriveModelMemoryState(
  caps: AsrHealthCapabilities | null | undefined,
): ModelMemoryState {
  const loaded = caps?.funasr_loaded_model_id?.trim();
  if (loaded) return "loaded";
  return "disk";
}
