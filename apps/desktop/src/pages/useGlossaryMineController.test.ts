import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGlossaryMineController } from "./useGlossaryMineController";

const dismissedPrompts = vi.hoisted(() => new Set<string>());

vi.mock("../tauri/correctionApi", () => ({
  correctionGlossaryMineCandidates: vi.fn(),
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

import { correctionGlossaryMineCandidates } from "../tauri/correctionApi";
import { glossaryAdd } from "../tauri/glossaryApi";
import { toast } from "../services/ui/toast";

describe("useGlossaryMineController", () => {
  beforeEach(() => {
    dismissedPrompts.clear();
    vi.mocked(correctionGlossaryMineCandidates).mockReset();
    vi.mocked(glossaryAdd).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("loads candidates on mount", async () => {
    vi.mocked(correctionGlossaryMineCandidates).mockResolvedValue([
      { afterText: "制控", hitCount: 2, sampleBefore: "智控" },
    ]);
    const onGlossaryChanged = vi.fn();
    const { result } = renderHook(() => useGlossaryMineController({ onGlossaryChanged }));

    await vi.waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.rows[0].afterText).toBe("制控");
  });

  it("adoptChecked calls glossaryAdd and refresh", async () => {
    vi.mocked(correctionGlossaryMineCandidates).mockResolvedValue([
      { afterText: "制控", hitCount: 2, sampleBefore: "智控" },
    ]);
    vi.mocked(glossaryAdd).mockResolvedValue({
      id: 1,
      term: "制控",
      aliases: "智控",
      domain: "",
      note: "",
      created_at_ms: 1,
      updated_at_ms: 1,
      hotword_enabled: true,
    });
    const onGlossaryChanged = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useGlossaryMineController({ onGlossaryChanged }));

    await vi.waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => {
      result.current.toggleChecked("制控");
    });

    act(() => {
      void result.current.adoptChecked();
    });

    await vi.waitFor(() => expect(onGlossaryChanged).toHaveBeenCalled());
    expect(glossaryAdd).toHaveBeenCalledWith(
      expect.objectContaining({ term: "制控", aliases: "", hotwordEnabled: true }),
    );
  });

  it("adoptRows keeps failed rows and toasts X/N on partial failure", async () => {
    vi.mocked(correctionGlossaryMineCandidates).mockResolvedValue([
      { afterText: "制控", hitCount: 2, sampleBefore: "智控" },
      { afterText: "语段", hitCount: 1, sampleBefore: "语段" },
    ]);
    vi.mocked(glossaryAdd)
      .mockResolvedValueOnce({
        id: 1,
        term: "制控",
        aliases: "",
        domain: "",
        note: "",
        created_at_ms: 1,
        updated_at_ms: 1,
        hotword_enabled: true,
      })
      .mockRejectedValueOnce(new Error("write failed"));
    const onGlossaryChanged = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useGlossaryMineController({ onGlossaryChanged }));

    await vi.waitFor(() => expect(result.current.rows).toHaveLength(2));

    act(() => {
      result.current.toggleAll();
    });
    act(() => {
      void result.current.adoptChecked();
    });

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("1/2"));
    await vi.waitFor(() =>
      expect(result.current.rows.map((r) => r.afterText)).toEqual(["语段"]),
    );
    expect(onGlossaryChanged).toHaveBeenCalled();
  });
});
