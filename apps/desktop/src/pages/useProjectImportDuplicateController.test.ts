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
  importTranscriptToProject: vi.fn(),
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
  const runWithUnsavedNavigateGate = vi.fn(async (onProceed: () => void | Promise<void>) => {
    await onProceed();
    return true;
  });
  const setError = vi.fn();

  return {
    deps: {
      currentProjectId: "proj-1",
      currentFileId: null,
      projectFiles: [],
      busy: false,
      busyReason: null,
      beginBusy,
      endBusy,
      loadProjectAfterImport,
      openFile,
      runWithUnsavedNavigateGate,
      setError,
      ...overrides,
    },
    beginBusy,
    endBusy,
    loadProjectAfterImport,
    openFile,
    runWithUnsavedNavigateGate,
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
    vi.mocked(fileApi.importTranscriptToProject).mockResolvedValue({
      outcome: "created_text",
      project: {
        id: "proj-1",
        name: "Project",
        files: [{ id: "text-1", name: "clip", file_type: "text", updated_at_ms: 1 }],
        created_at_ms: 1,
        updated_at_ms: 1,
      },
      file_id: "text-1",
    });
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

  it("editor text attach skips duplicate check and passes target file id", async () => {
    const { deps, loadProjectAfterImport, runWithUnsavedNavigateGate } = makeDeps({
      currentFileId: "file-current",
    });
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    await act(async () => {
      const ok = await result.current.importFileToProject("text", "/tmp/interview.srt");
      expect(ok).toBe(true);
    });

    expect(fileApi.checkProjectImportDuplicate).not.toHaveBeenCalled();
    expect(fileApi.importTranscriptToProject).toHaveBeenCalledWith(
      "proj-1",
      "/tmp/interview.srt",
      "file-current",
    );
    expect(runWithUnsavedNavigateGate).toHaveBeenCalled();
    expect(loadProjectAfterImport).toHaveBeenCalledWith("proj-1", "text-1");
  });

  it("editor text attach blocked during transcribe", async () => {
    const { deps } = makeDeps({
      currentFileId: "file-current",
      busy: true,
      busyReason: "transcribe",
    });
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    await act(async () => {
      const ok = await result.current.importFileToProject("text", "/tmp/interview.srt");
      expect(ok).toBe(false);
    });

    expect(toast.error).toHaveBeenCalledWith("转写进行中，请稍后再导入字幕。");
    expect(fileApi.importTranscriptToProject).not.toHaveBeenCalled();
  });

  it("hub text with no stem match runs duplicate check before import", async () => {
    vi.mocked(fileApi.checkProjectImportDuplicate).mockResolvedValue(duplicateCheck());
    const { deps } = makeDeps({
      projectFiles: [{ name: "会议", file_type: "paired" }],
    });
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    let importPromise: Promise<boolean>;
    act(() => {
      importPromise = result.current.importFileToProject("text", "/tmp/other.srt");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.duplicateImportConfirmOpen).toBe(true);
    expect(fileApi.importTranscriptToProject).not.toHaveBeenCalled();

    act(() => {
      result.current.cancelDuplicateImport();
    });

    await act(async () => {
      await importPromise!;
    });
  });

  it("hub text with stem match skips duplicate check", async () => {
    vi.mocked(fileApi.checkProjectImportDuplicate).mockResolvedValue(duplicateCheck());
    const { deps } = makeDeps({
      projectFiles: [{ name: "采访", file_type: "paired" }],
    });
    const { result } = renderHook(() => useProjectImportDuplicateController(deps));

    await act(async () => {
      const ok = await result.current.importFileToProject("text", "/tmp/采访.srt");
      expect(ok).toBe(true);
    });

    expect(fileApi.checkProjectImportDuplicate).not.toHaveBeenCalled();
    expect(fileApi.importTranscriptToProject).toHaveBeenCalledWith(
      "proj-1",
      "/tmp/采访.srt",
      undefined,
    );
  });
});
