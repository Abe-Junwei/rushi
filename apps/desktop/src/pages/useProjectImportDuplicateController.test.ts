import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectImportDuplicateController } from "./useProjectImportDuplicateController";

vi.mock("../services/ui/toast", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../tauri/fileApi", () => ({
  checkProjectImportDuplicate: vi.fn(),
  importAudioToProject: vi.fn(),
  importTextToProject: vi.fn(),
  pickAudioPath: vi.fn(),
  pickTextPath: vi.fn(),
}));

import { toast } from "../services/ui/toast";
import * as fileApi from "../tauri/fileApi";

function duplicateCheck() {
  return {
    bySourcePath: [{ fileId: "existing-1", fileName: "clip.wav" }],
    byContentHash: [],
  };
}

function makeDeps(overrides: Partial<Parameters<typeof useProjectImportDuplicateController>[0]> = {}) {
  const beginBusy = vi.fn();
  const endBusy = vi.fn();
  const loadProjectAfterImport = vi.fn(() => Promise.resolve());
  const openFile = vi.fn(() => Promise.resolve());
  const setError = vi.fn();

  return {
    deps: {
      currentProjectId: "proj-1",
      busy: false,
      beginBusy,
      endBusy,
      loadProjectAfterImport,
      openFile,
      setError,
      ...overrides,
    },
    beginBusy,
    endBusy,
    loadProjectAfterImport,
    openFile,
    setError,
  };
}

describe("useProjectImportDuplicateController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fileApi.checkProjectImportDuplicate).mockResolvedValue({
      bySourcePath: [],
      byContentHash: [],
    });
    vi.mocked(fileApi.importAudioToProject).mockResolvedValue(undefined as never);
  });

  it("shows duplicate dialog without beginBusy during check and prompt", async () => {
    vi.mocked(fileApi.checkProjectImportDuplicate).mockResolvedValue(duplicateCheck());
    const { deps, beginBusy } = makeDeps();
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    let importPromise: Promise<boolean>;
    act(() => {
      importPromise = result.current.importFileToProject("audio", "/tmp/clip.wav");
    });

    expect(result.current.duplicateImportChecking).toBe(true);
    expect(beginBusy).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.duplicateImportConfirmOpen).toBe(true);
    expect(result.current.duplicateImportChecking).toBe(false);
    expect(beginBusy).not.toHaveBeenCalled();

    act(() => {
      result.current.cancelDuplicateImport();
    });

    await act(async () => {
      await importPromise!;
    });

    expect(beginBusy).not.toHaveBeenCalled();
    expect(fileApi.importAudioToProject).not.toHaveBeenCalled();
  });

  it("import copy begins busy only after user confirms duplicate", async () => {
    vi.mocked(fileApi.checkProjectImportDuplicate).mockResolvedValue(duplicateCheck());
    const { deps, beginBusy, endBusy, loadProjectAfterImport } = makeDeps();
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    let importPromise: Promise<boolean>;
    act(() => {
      importPromise = result.current.importFileToProject("audio", "/tmp/clip.wav");
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.confirmDuplicateImportCopy();
    });

    await act(async () => {
      await importPromise!;
    });

    expect(beginBusy).toHaveBeenCalledWith("import");
    expect(endBusy).toHaveBeenCalled();
    expect(fileApi.importAudioToProject).toHaveBeenCalledWith("proj-1", "clip", "/tmp/clip.wav");
    expect(loadProjectAfterImport).toHaveBeenCalledWith("proj-1");
  });

  it("open existing duplicate opens file without importing", async () => {
    vi.mocked(fileApi.checkProjectImportDuplicate).mockResolvedValue(duplicateCheck());
    const { deps, openFile, beginBusy } = makeDeps();
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    let importPromise: Promise<boolean>;
    act(() => {
      importPromise = result.current.importFileToProject("audio", "/tmp/clip.wav");
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.openExistingDuplicateImport();
    });

    await act(async () => {
      await importPromise!;
    });

    expect(openFile).toHaveBeenCalledWith("existing-1");
    expect(beginBusy).not.toHaveBeenCalled();
    expect(fileApi.importAudioToProject).not.toHaveBeenCalled();
  });

  it("returns false with toast when global busy", async () => {
    const { deps } = makeDeps({ busy: true });
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    await act(async () => {
      const ok = await result.current.importFileToProject("audio", "/tmp/clip.wav");
      expect(ok).toBe(false);
    });

    expect(toast.error).toHaveBeenCalled();
    expect(fileApi.checkProjectImportDuplicate).not.toHaveBeenCalled();
  });
});
