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

  it("syncs stage counts from current.files when project updated_at_ms changes", async () => {
    const fileV1 = {
      id: "f1",
      name: "a.wav",
      file_type: "audio",
      updated_at_ms: 1,
      segment_count: 1,
      draft_count: 1,
      first_proof_count: 0,
      finalized_count: 0,
    } as fileApi.FileSummary;
    const fileV2 = {
      ...fileV1,
      updated_at_ms: 2,
      draft_count: 0,
      first_proof_count: 1,
    };

    let current: {
      id: string;
      updated_at_ms: number;
      files: fileApi.FileSummary[];
    } = {
      id: "proj-cur",
      updated_at_ms: 10,
      files: [fileV1],
    };

    const c = {
      get current() {
        return current;
      },
      setError: vi.fn(),
      loadProject: vi.fn(),
      openFile: vi.fn(),
    } as unknown as import("../pages/useProjectController").ProjectControllerApi;

    const { result, rerender } = renderHook(() => useWelcomeProjectTree(c));

    await waitFor(() => {
      expect(result.current.projectFilesById["proj-cur"]?.[0]?.first_proof_count).toBe(0);
    });
    expect(fileApi.listFiles).not.toHaveBeenCalled();

    current = {
      id: "proj-cur",
      updated_at_ms: 20,
      files: [fileV2],
    };
    rerender();

    await waitFor(() => {
      expect(result.current.projectFilesById["proj-cur"]?.[0]?.first_proof_count).toBe(1);
    });
    expect(fileApi.listFiles).not.toHaveBeenCalled();
  });
});
