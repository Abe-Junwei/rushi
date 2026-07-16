import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGlossaryLearnPromptController } from "./useGlossaryLearnPromptController";

const dismissedPrompts = vi.hoisted(() => new Set<string>());

vi.mock("../tauri/correctionApi", () => ({
  correctionGlossaryLearnPrompts: vi.fn(),
}));

vi.mock("../tauri/glossaryApi", () => ({
  glossaryAdd: vi.fn(),
}));

vi.mock("../utils/glossaryPromptDismiss", () => ({
  dismissGlossaryPrompt: vi.fn((afterText: string) => {
    dismissedPrompts.add(afterText);
  }),
  filterUndismissedPrompts: <T extends { afterText: string }>(rows: T[]) =>
    rows.filter((r) => !dismissedPrompts.has(r.afterText)),
}));

vi.mock("../services/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { correctionGlossaryLearnPrompts } from "../tauri/correctionApi";
import { glossaryAdd } from "../tauri/glossaryApi";
import { toast } from "../services/ui/toast";

describe("useGlossaryLearnPromptController", () => {
  beforeEach(() => {
    dismissedPrompts.clear();
    vi.mocked(correctionGlossaryLearnPrompts).mockReset();
    vi.mocked(glossaryAdd).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("confirmAddToGlossary writes term only (no sampleBefore as alias)", async () => {
    vi.mocked(correctionGlossaryLearnPrompts).mockResolvedValue([
      { afterText: "香板", hitCount: 7, sampleBefore: "乡版" },
    ]);
    vi.mocked(glossaryAdd).mockResolvedValue({
      id: 1,
      term: "香板",
      aliases: "",
      domain: "",
      note: "",
      created_at_ms: 1,
      updated_at_ms: 1,
      hotword_enabled: true,
    });
    const setError = vi.fn();
    const { result } = renderHook(() => useGlossaryLearnPromptController({ setError }));

    await act(async () => {
      await result.current.checkGlossaryLearnAfterSave();
    });
    expect(result.current.glossaryLearnDialog.phase).toBe("prompt");

    await act(async () => {
      await result.current.confirmAddToGlossary({
        afterText: "香板",
        hitCount: 7,
        sampleBefore: "乡版",
      });
    });

    expect(glossaryAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        term: "香板",
        aliases: "",
        hotwordEnabled: true,
        note: expect.stringContaining("乡版→香板"),
      }),
    );
    expect(setError).toHaveBeenCalledWith("");
    expect(toast.success).toHaveBeenCalled();
    expect(result.current.glossaryLearnDialog.phase).toBe("closed");
  });

  it("treats already-exists as success and dismisses the prompt", async () => {
    vi.mocked(correctionGlossaryLearnPrompts).mockResolvedValue([
      { afterText: "香板", hitCount: 7, sampleBefore: "乡版" },
    ]);
    vi.mocked(glossaryAdd).mockRejectedValue(new Error("该术语已存在（忽略大小写）"));
    const setError = vi.fn();
    const { result } = renderHook(() => useGlossaryLearnPromptController({ setError }));

    await act(async () => {
      await result.current.checkGlossaryLearnAfterSave();
    });
    expect(result.current.glossaryLearnDialog.phase).toBe("prompt");

    await act(async () => {
      await result.current.confirmAddToGlossary({
        afterText: "香板",
        hitCount: 7,
        sampleBefore: "乡版",
      });
    });

    expect(setError).not.toHaveBeenCalledWith(expect.stringMatching(/错形|不能写入/));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("已在术语表中"));
    expect(result.current.glossaryLearnDialog.phase).toBe("closed");
  });
});
