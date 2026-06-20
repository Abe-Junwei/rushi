import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useProjectLifecycleErrorState } from "./projectLifecycleErrorState";

vi.mock("../services/ui/toast", () => ({
  toast: { error: vi.fn() },
}));

import { toast } from "../services/ui/toast";

describe("useProjectLifecycleErrorState", () => {
  it("mirrors new errors to toast after commit, not inside setState", () => {
    const { result } = renderHook(() => useProjectLifecycleErrorState());

    act(() => {
      result.current.setError("load failed");
    });

    expect(result.current.error).toBe("load failed");
    expect(toast.error).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setError("load failed");
    });

    expect(toast.error).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setError("other failure");
    });

    expect(toast.error).toHaveBeenCalledTimes(2);
  });
});
