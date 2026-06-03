import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManualCorrectionMemoryDialog } from "./useManualCorrectionMemoryDialog";

vi.mock("../services/manualCorrectionMemory", () => ({
  saveManualCorrectionMemoryPair: vi.fn().mockResolvedValue(undefined),
  validateManualCorrectionMemoryPair: vi.fn(() => ({
    ok: true as const,
    beforeText: "智控",
    afterText: "制控",
  })),
}));

vi.mock("../services/promoteLearnPairToGlossary", () => ({
  promoteAfterTextsToGlossary: vi.fn().mockResolvedValue({ added: 0, skipped: 0 }),
  formatPromoteToGlossaryToast: vi.fn(() => null),
}));

vi.mock("../services/ui/toast", () => ({
  toast: { success: vi.fn() },
}));

import { saveManualCorrectionMemoryPair } from "../services/manualCorrectionMemory";

describe("useManualCorrectionMemoryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls checkGlossaryLearnAfterSave after successful manual save", async () => {
    const checkGlossaryLearnAfterSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useManualCorrectionMemoryDialog({
        busy: false,
        setError: vi.fn(),
        checkGlossaryLearnAfterSave,
      }),
    );

    act(() => {
      result.current.openManualCorrectionMemoryDialog("智控");
    });
    act(() => {
      result.current.setManualCorrectionRight("制控");
    });
    await act(async () => {
      await result.current.confirmManualCorrectionMemory();
    });

    expect(saveManualCorrectionMemoryPair).toHaveBeenCalledWith("智控", "制控");
    expect(checkGlossaryLearnAfterSave).toHaveBeenCalledTimes(1);
    expect(result.current.manualCorrectionMemoryDialog.phase).toBe("closed");
  });

  it("does not call checkGlossaryLearnAfterSave when validation fails", async () => {
    const { validateManualCorrectionMemoryPair } = await import("../services/manualCorrectionMemory");
    vi.mocked(validateManualCorrectionMemoryPair).mockReturnValueOnce({
      ok: false,
      reason: "bad pair",
    });

    const checkGlossaryLearnAfterSave = vi.fn();
    const { result } = renderHook(() =>
      useManualCorrectionMemoryDialog({
        busy: false,
        setError: vi.fn(),
        checkGlossaryLearnAfterSave,
      }),
    );

    act(() => {
      result.current.openManualCorrectionMemoryDialog("其");
    });
    act(() => {
      result.current.setManualCorrectionRight("七");
    });
    await act(async () => {
      await result.current.confirmManualCorrectionMemory();
    });

    expect(saveManualCorrectionMemoryPair).not.toHaveBeenCalled();
    expect(checkGlossaryLearnAfterSave).not.toHaveBeenCalled();
  });
});
