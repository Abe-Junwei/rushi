import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectFileMutationController } from "./useProjectFileMutationController";

vi.mock("../tauri/fileApi", () => ({
  renameFile: vi.fn(() => Promise.resolve()),
  deleteFile: vi.fn(() => Promise.resolve()),
  moveFileToProject: vi.fn(() =>
    Promise.resolve({
      fileId: "f1",
      finalName: "clip.wav",
      renamed: false,
    }),
  ),
  copyFileToProject: vi.fn(() =>
    Promise.resolve({
      fileId: "f2",
      finalName: "clip.wav",
      renamed: false,
    }),
  ),
  revealProjectInFileManager: vi.fn(() => Promise.resolve()),
  revealFileInFileManager: vi.fn(() => Promise.resolve()),
}));

vi.mock("../services/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import * as fileApi from "../tauri/fileApi";

describe("useProjectFileMutationController move", () => {
  beforeEach(() => {
    vi.mocked(fileApi.moveFileToProject).mockClear();
  });

  it("confirmMove closes open file then moves and invalidates caches", async () => {
    const refreshProjectHub = vi.fn(() => Promise.resolve());
    const refreshProjects = vi.fn(() => Promise.resolve());
    const closeOpenFileIfNeeded = vi.fn(() => Promise.resolve());
    const invalidateProjectFilesCaches = vi.fn();
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useProjectFileMutationController({
        projectId: "src",
        busy: false,
        refreshProjectHub,
        refreshProjects,
        closeOpenFileIfNeeded,
        invalidateProjectFilesCaches,
        setError,
      }),
    );

    act(() => {
      result.current.requestMoveProjectFile({
        fileId: "f1",
        fileName: "clip.wav",
        sourceProjectId: "src",
        destProjectId: "dest",
        destProjectName: "Dest",
      });
    });
    expect(result.current.pendingProjectFileMove?.fileId).toBe("f1");

    await act(async () => {
      await result.current.confirmMoveProjectFile();
    });

    expect(closeOpenFileIfNeeded).toHaveBeenCalledWith("f1");
    expect(fileApi.moveFileToProject).toHaveBeenCalledWith("f1", "dest");
    expect(refreshProjects).toHaveBeenCalled();
    expect(refreshProjectHub).toHaveBeenCalledWith("src");
    expect(invalidateProjectFilesCaches).toHaveBeenCalledWith(["src", "dest"]);
    expect(result.current.pendingProjectFileMove).toBeNull();
  });

  it("clears move dialog when close gate cancels", async () => {
    const closeOpenFileIfNeeded = vi.fn(() =>
      Promise.reject(new Error("已取消移动：文件仍处于打开状态。")),
    );
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useProjectFileMutationController({
        projectId: "src",
        busy: false,
        refreshProjectHub: vi.fn(() => Promise.resolve()),
        refreshProjects: vi.fn(() => Promise.resolve()),
        closeOpenFileIfNeeded,
        setError,
      }),
    );

    act(() => {
      result.current.requestMoveProjectFile({
        fileId: "f1",
        fileName: "clip.wav",
        sourceProjectId: "src",
        destProjectId: "dest",
        destProjectName: "Dest",
      });
    });

    await act(async () => {
      await result.current.confirmMoveProjectFile();
    });

    expect(result.current.pendingProjectFileMove).toBeNull();
    expect(setError).toHaveBeenCalled();
    expect(fileApi.moveFileToProject).not.toHaveBeenCalled();
  });
});
