import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail, ProjectSummary, SegmentDto } from "../tauri/projectApi";
import { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { SegmentDirtyStateApi } from "./useSegmentDirtyState";

const destroyMock = vi.fn<() => Promise<void>>(async () => undefined);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    destroy: destroyMock,
    onCloseRequested: vi.fn(async () => () => undefined),
  })),
}));

vi.mock("../services/lastWorkspace", () => ({
  resolveEditorResumeTarget: vi.fn(async () => null),
  writeLastWorkspace: vi.fn(),
}));

vi.mock("../hooks/useSegmentDraftStore", () => ({
  segmentDraftStore: { resetAll: vi.fn() },
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
  const openFile = vi.fn(async () => [{ uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "a" }] as SegmentDto[]);
  const saveSegments = vi.fn(async () => true);
  const resetMutationHistory = vi.fn();

  return {
    applyDetail,
    beginBusy: vi.fn(),
    busy: false,
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

  it("stayAfterCloseAttempt dismisses gate without leaving project", async () => {
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
});
