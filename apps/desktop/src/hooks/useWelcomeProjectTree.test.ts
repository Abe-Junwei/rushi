import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useWelcomeProjectTree } from "./useWelcomeProjectTree";
import * as fileApi from "../tauri/fileApi";

vi.mock("../tauri/fileApi", () => ({
  listFiles: vi.fn(),
}));

describe("useWelcomeProjectTree", () => {
  beforeEach(() => {
    vi.mocked(fileApi.listFiles).mockReset();
  });

  it("does not refetch when listFiles resolves null (treat as loaded)", async () => {
    vi.mocked(fileApi.listFiles).mockResolvedValue(null as unknown as fileApi.FileSummary[]);

    const c = {
      current: null,
      setError: vi.fn(),
      loadProject: vi.fn(),
      openFile: vi.fn(),
    } as unknown as import("../pages/useProjectController").ProjectControllerApi;

    const { result } = renderHook(() => useWelcomeProjectTree(c));

    act(() => {
      result.current.toggleProjectExpanded("proj-1", false);
    });

    await waitFor(() => {
      expect(fileApi.listFiles).toHaveBeenCalledTimes(1);
    });

    await act(() => Promise.resolve());

    expect(result.current.projectFilesById["proj-1"]).toEqual([]);
    expect(fileApi.listFiles).toHaveBeenCalledTimes(1);
  });

  it("auto-expands current project id", async () => {
    vi.mocked(fileApi.listFiles).mockResolvedValue([]);

    const c = {
      current: { id: "proj-cur" },
      setError: vi.fn(),
      loadProject: vi.fn(),
      openFile: vi.fn(),
    } as unknown as import("../pages/useProjectController").ProjectControllerApi;

    const { result } = renderHook(() => useWelcomeProjectTree(c));

    await waitFor(() => {
      expect(result.current.expandedProjectId).toBe("proj-cur");
      expect(fileApi.listFiles).toHaveBeenCalledWith("proj-cur");
    });
  });
});
