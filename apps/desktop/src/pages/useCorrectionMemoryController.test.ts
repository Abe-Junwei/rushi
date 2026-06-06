import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCorrectionMemoryController } from "./useCorrectionMemoryController";

vi.mock("../tauri/correctionApi", () => ({
  correctionMemoryList: vi.fn(),
  correctionMemorySave: vi.fn(),
  correctionMemoryDelete: vi.fn(),
  correctionAcceptRule: vi.fn(),
}));

import {
  correctionMemoryList,
  correctionMemorySave,
} from "../tauri/correctionApi";

describe("useCorrectionMemoryController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(correctionMemoryList).mockResolvedValue([
      {
        wrong: "安波那那",
        right: "安那般那",
        hitCount: 2,
        isStable: true,
        acceptedAsRule: false,
        updatedAtMs: 1,
      },
    ]);
    vi.mocked(correctionMemorySave).mockResolvedValue(undefined);
  });

  it("loads correction memory rows on mount", async () => {
    const { result } = renderHook(() => useCorrectionMemoryController());

    await vi.waitFor(() => {
      expect(result.current.rows).toHaveLength(1);
    });
    expect(result.current.rows[0].wrong).toBe("安波那那");
  });

  it("saveDraft persists new entry and refreshes list", async () => {
    vi.mocked(correctionMemoryList)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          wrong: "智控",
          right: "制控",
          hitCount: 1,
          isStable: false,
          acceptedAsRule: false,
          updatedAtMs: 2,
        },
      ]);

    const { result } = renderHook(() => useCorrectionMemoryController());
    await vi.waitFor(() => expect(result.current.rows).toEqual([]));

    act(() => {
      result.current.updateDraftField("wrong", "智控");
      result.current.updateDraftField("right", "制控");
    });

    await act(async () => {
      await result.current.saveDraft();
    });

    expect(correctionMemorySave).toHaveBeenCalledWith({
      wrong: "智控",
      right: "制控",
      acceptedAsRule: false,
      replaceWrong: undefined,
      replaceRight: undefined,
    });
    expect(result.current.statusMessage).toBe("已添加纠错记忆");
  });
});
