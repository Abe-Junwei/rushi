import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { SegmentDirtyStateApi } from "./useSegmentDirtyState";

const destroyMock = vi.fn<() => Promise<void>>(() => Promise.resolve(undefined));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    destroy: destroyMock,
    onCloseRequested: vi.fn(() => Promise.resolve(() => undefined)),
  })),
}));

vi.mock("../services/lastWorkspace", () => ({
  resolveEditorResumeTarget: vi.fn(() => Promise.resolve(null)),
  writeLastWorkspace: vi.fn(),
}));

vi.mock("../tauri/projectApi", () => ({
  projectLoad: vi.fn(),
}));

import { projectLoad } from "../tauri/projectApi";

function makeDetail(id: string): ProjectDetail {
  return {
    id,
    name: "测试项目",
    audio_storage_path: "/tmp/a.wav",
    created_at_ms: 1,
    updated_at_ms: 2,
    segments: [],
    files: [{ id: "file-1", name: "a.wav", file_type: "paired", updated_at_ms: 2 }],
  };
}

function makeDirty(hasUnsaved: boolean): SegmentDirtyStateApi {
  return {
    hasUnsavedSegmentChanges: () => hasUnsaved,
    markSegmentsSaved: vi.fn(),
    setSavedSnapshot: vi.fn(),
    getSavedSnapshot: () => [],
    clearSavedSnapshot: vi.fn(),
    confirmDiscardUnsavedIfNeeded: () => true,
  };
}

function baseArgs(overrides: Partial<Parameters<typeof useProjectCloseGateController>[0]> = {}) {
  const applyDetail = vi.fn();
  const closeFile = vi.fn();
  const openFile = vi.fn(() =>
    Promise.resolve([{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "a" }] as SegmentDto[]),
  );
  const saveSegments = vi.fn(() => Promise.resolve(true));
  const resetMutationHistory = vi.fn();

  return {
    applyDetail,
    beginBusy: vi.fn(),
    busy: false,
    busyReason: null,
    cancelTranscribe: vi.fn(),
    closeFile,
    current: makeDetail("proj-a"),
    currentFileId: "file-1",
    dirty: makeDirty(false),
    endBusy: vi.fn(),
    openFile,
    saveSegments,
    setCurrent: vi.fn(),
    setError: vi.fn(),
    setTranscribeHints: vi.fn(),
    resetMutationHistory,
    projects: [{ id: "proj-a", name: "测试项目", updated_at_ms: 2 }] as ProjectSummary[],
    ...overrides,
  };
}

describe("useProjectCloseGateController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectLoad).mockResolvedValue(makeDetail("proj-b"));
  });

  it("loadProject opens close gate when switching projects with unsaved edits", async () => {
    const args = baseArgs({ dirty: makeDirty(true) });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.loadProject("proj-b");
    });

    expect(result.current.closeGateOpen).toBe(true);
    expect(result.current.closeGateIntent).toBe("navigate");
    expect(projectLoad).not.toHaveBeenCalled();
  });

  it("loadProject proceeds immediately when segments are saved", async () => {
    const args = baseArgs();
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.loadProject("proj-b");
    });

    expect(result.current.closeGateOpen).toBe(false);
    expect(projectLoad).toHaveBeenCalledWith("proj-b");
    expect(args.applyDetail).toHaveBeenCalled();
    expect(args.closeFile).toHaveBeenCalled();
    expect(args.openFile).not.toHaveBeenCalled();
  });

  it("saveAndClose saves then proceeds navigate intent", async () => {
    const args = baseArgs({ dirty: makeDirty(true) });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.loadProject("proj-b");
    });

    await act(async () => {
      await result.current.saveAndClose();
    });

    expect(args.saveSegments).toHaveBeenCalled();
    expect(result.current.closeGateOpen).toBe(false);
    expect(projectLoad).toHaveBeenCalledWith("proj-b");
  });

  it("closeProjectWrapped opens gate when dirty", () => {
    const args = baseArgs({ dirty: makeDirty(true) });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    act(() => {
      result.current.closeProjectWrapped();
    });

    expect(result.current.closeGateOpen).toBe(true);
    expect(result.current.closeGateIntent).toBe("navigate");
    expect(args.closeFile).not.toHaveBeenCalled();
  });

  it("stayAfterCloseAttempt dismisses gate without leaving project", () => {
    const args = baseArgs({ dirty: makeDirty(true) });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    act(() => {
      result.current.closeProjectWrapped();
    });

    act(() => {
      result.current.stayAfterCloseAttempt();
    });

    expect(result.current.closeGateOpen).toBe(false);
    expect(args.closeFile).not.toHaveBeenCalled();
  });

  it("loadProject on hub (no current file) refreshes list without opening editor", async () => {
    const detail = makeDetail("proj-a");
    vi.mocked(projectLoad).mockResolvedValue(detail);
    const args = baseArgs({ currentFileId: null });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.loadProject("proj-a");
    });

    expect(projectLoad).toHaveBeenCalledWith("proj-a");
    expect(args.applyDetail).toHaveBeenCalled();
    expect(args.openFile).not.toHaveBeenCalled();
  });

  it("loadProjectAfterImport opens newest file", async () => {
    const detail = makeDetail("proj-a");
    detail.files = [
      { id: "file-old", name: "old.wav", file_type: "paired", updated_at_ms: 1 },
      { id: "file-new", name: "new.wav", file_type: "paired", updated_at_ms: 99 },
    ];
    vi.mocked(projectLoad).mockResolvedValue(detail);
    const args = baseArgs({ currentFileId: null });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.loadProjectAfterImport("proj-a");
    });

    expect(args.openFile).toHaveBeenCalledWith("file-new");
  });

  it("loadProjectAfterImport opens preferred file when provided", async () => {
    const detail = makeDetail("proj-a");
    detail.files = [
      { id: "file-old", name: "old.wav", file_type: "paired", updated_at_ms: 1 },
      { id: "file-new", name: "new.wav", file_type: "paired", updated_at_ms: 99 },
    ];
    vi.mocked(projectLoad).mockResolvedValue(detail);
    const args = baseArgs({ currentFileId: null });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.loadProjectAfterImport("proj-a", "file-old");
    });

    expect(args.openFile).toHaveBeenCalledWith("file-old");
  });

  it("loadProjectAfterImport reloads same file even when segment edits are dirty", async () => {
    const detail = makeDetail("proj-a");
    detail.files = [{ id: "file-1", name: "a.wav", file_type: "paired", updated_at_ms: 2 }];
    vi.mocked(projectLoad).mockResolvedValue(detail);
    const args = baseArgs({ currentFileId: "file-1", dirty: makeDirty(true) });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.loadProjectAfterImport("proj-a", "file-1");
    });

    expect(args.openFile).toHaveBeenCalledWith("file-1");
    expect(args.dirty.setSavedSnapshot).toHaveBeenCalled();
  });

  it("confirmTranscribeNavBlock chains unsaved gate after stopping transcribe", async () => {
    const args = baseArgs({
      busy: true,
      busyReason: "transcribe",
      dirty: makeDirty(true),
    });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    act(() => {
      result.current.closeFileWrapped();
    });

    expect(result.current.transcribeNavBlockOpen).toBe(true);

    await act(async () => {
      await result.current.confirmTranscribeNavBlock();
    });

    expect(args.cancelTranscribe).toHaveBeenCalled();
    expect(result.current.transcribeNavBlockOpen).toBe(false);
    expect(result.current.closeGateOpen).toBe(true);
    expect(args.closeFile).not.toHaveBeenCalled();
  });

  it("openWorkspaceFile loads project and opens file atomically", async () => {
    const detail = makeDetail("proj-b");
    vi.mocked(projectLoad).mockResolvedValue(detail);
    const args = baseArgs({ current: null, currentFileId: null });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    await act(async () => {
      await result.current.openWorkspaceFile("proj-b", "file-1");
    });

    expect(projectLoad).toHaveBeenCalledWith("proj-b");
    expect(args.applyDetail).toHaveBeenCalled();
    expect(args.openFile).toHaveBeenCalledWith("file-1");
    expect(result.current.openingWorkspaceTarget).toBeNull();
  });

  it("confirmTranscribeNavBlock stops batch transcribe before navigate", async () => {
    const cancelBatchTranscribe = vi.fn(() => Promise.resolve());
    const args = baseArgs({
      busy: true,
      busyReason: "batch_transcribe",
      cancelBatchTranscribe,
    });
    const { result } = renderHook(() => useProjectCloseGateController(args));

    act(() => {
      result.current.closeFileWrapped();
    });

    expect(result.current.transcribeNavBlockOpen).toBe(true);

    await act(async () => {
      await result.current.confirmTranscribeNavBlock();
    });

    expect(cancelBatchTranscribe).toHaveBeenCalled();
    expect(args.cancelTranscribe).not.toHaveBeenCalled();
    expect(result.current.transcribeNavBlockOpen).toBe(false);
    expect(args.closeFile).toHaveBeenCalled();
  });
});
