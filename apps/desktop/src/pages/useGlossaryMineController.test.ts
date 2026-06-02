import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGlossaryMineController } from "./useGlossaryMineController";

vi.mock("../tauri/correctionApi", () => ({
  correctionGlossaryMineCandidates: vi.fn(),
}));

vi.mock("../tauri/glossaryApi", () => ({
  glossaryAdd: vi.fn(),
}));

vi.mock("../utils/glossaryPromptDismiss", () => ({
  dismissGlossaryPrompt: vi.fn(),
  filterUndismissedPrompts: <T extends { afterText: string }>(rows: T[]) => rows,
}));

vi.mock("../services/ui/toast", () => ({
  toast: { success: vi.fn() },
}));

import { correctionGlossaryMineCandidates } from "../tauri/correctionApi";
import { glossaryAdd } from "../tauri/glossaryApi";

describe("useGlossaryMineController", () => {
  beforeEach(() => {
    vi.mocked(correctionGlossaryMineCandidates).mockReset();
    vi.mocked(glossaryAdd).mockReset();
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

    await act(async () => {
      result.current.adoptChecked();
    });

    expect(glossaryAdd).toHaveBeenCalledWith(
      expect.objectContaining({ term: "制控", hotwordEnabled: true }),
    );
    expect(onGlossaryChanged).toHaveBeenCalled();
  });
});
