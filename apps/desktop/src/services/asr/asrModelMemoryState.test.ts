import { describe, expect, it } from "vitest";
import { deriveModelMemoryState } from "./asrModelMemoryState";
import { DEFAULT_LOCAL_ASR_HUB_MODEL_ID } from "./localAsrModelCatalog";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";

describe("deriveModelMemoryState", () => {
  it("returns loaded when funasr_loaded_model_id is set", () => {
    expect(
      deriveModelMemoryState({
        funasr_loaded_model_id: DEFAULT_LOCAL_ASR_HUB_MODEL_ID,
        selected_model_ready: true,
      } as AsrHealthCapabilities),
    ).toBe("loaded");
  });

  it("returns disk when loaded id is empty but ready_for_transcribe", () => {
    expect(
      deriveModelMemoryState({
        ready_for_transcribe: true,
        funasr_loaded_model_id: null,
        selected_model_ready: false,
      } as AsrHealthCapabilities),
    ).toBe("disk");
  });

  it("returns disk when caps are null", () => {
    expect(deriveModelMemoryState(null)).toBe("disk");
  });
});
