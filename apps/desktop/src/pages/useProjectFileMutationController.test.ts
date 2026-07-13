import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectFileMutationController } from "./useProjectFileMutationController";

vi.mock("../tauri/fileApi", () => ({
  renameFile: vi.fn(async () => {}),
  deleteFile: vi.fn(async () => {}),
  moveFileToProject: vi.fn(async () => ({
    fileId: "f1",
    finalName: "clip.wav",
    renamed: false,
  })),
  copyFileToProject: vi.fn(async () => ({
    fileId: "f2",
    finalName: "clip.wav",
    renamed: false,
  })),
  revealProjectInFileManager: vi.fn(async () => {}),
  revealFileInFileManager: vi.fn(async () => {}),
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
    const refreshProjectHub = vi.fn(async () => {});
    const refreshProjects = vi.fn(async () => {});
    const closeOpenFileIfNeeded = vi.fn(async () => {});
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
    const closeOpenFileIfNeeded = vi.fn(async () => {
      throw new Error("已取消移动：文件仍处于打开状态。");
    });
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useProjectFileMutationController({
        projectId: "src",
        busy: false,
        refreshProjectHub: vi.fn(async () => {}),
        refreshProjects: vi.fn(async () => {}),
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
