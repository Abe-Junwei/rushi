import { describe, expect, it, vi } from "vitest";
import {
  saveManualCorrectionMemoryPair,
  validateManualCorrectionMemoryPair,
} from "./manualCorrectionMemory";

vi.mock("../tauri/correctionApi", () => ({
  correctionMemorySave: vi.fn().mockResolvedValue(undefined),
}));

import { correctionMemorySave } from "../tauri/correctionApi";

describe("manualCorrectionMemory", () => {
  it("rejects empty selection", () => {
    expect(validateManualCorrectionMemoryPair("  ", "正形")).toEqual({
      ok: false,
      reason: "请先选中要更正的文本。",
    });
  });

  it("accepts multi-char CJK pair", () => {
    expect(validateManualCorrectionMemoryPair("激行", "经行")).toEqual({
      ok: true,
      beforeText: "激行",
      afterText: "经行",
    });
  });

  it("saves normalized pair", async () => {
    await saveManualCorrectionMemoryPair("视死", "誓死");
    expect(correctionMemorySave).toHaveBeenCalledWith({
      wrong: "视死",
      right: "誓死",
      acceptedAsRule: false,
    });
  });
});
