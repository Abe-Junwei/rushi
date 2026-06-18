import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useWelcomeSidebarProjectTree } from "./useWelcomeSidebarProjectTree";
import * as fileApi from "../tauri/fileApi";

vi.mock("../tauri/fileApi", () => ({
  listFiles: vi.fn(),
}));

describe("useWelcomeSidebarProjectTree", () => {
  beforeEach(() => {
    vi.mocked(fileApi.listFiles).mockReset();
  });

  it("does not refetch when listFiles resolves null (treat as loaded)", async () => {
    vi.mocked(fileApi.listFiles).mockResolvedValue(null as unknown as fileApi.FileSummary[]);

    const c = {
      current: { id: "proj-1" },
      setError: vi.fn(),
      loadProject: vi.fn(),
      openFile: vi.fn(),
    } as unknown as import("../pages/useProjectController").ProjectControllerApi;

    const { result } = renderHook(() =>
      useWelcomeSidebarProjectTree(c, {
        hubMode: true,
        editorMode: false,
        activeProjectId: "proj-1",
      }),
    );

    await waitFor(() => {
      expect(fileApi.listFiles).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.projectFilesById["proj-1"]).toEqual([]);
    expect(fileApi.listFiles).toHaveBeenCalledTimes(1);
  });
});
