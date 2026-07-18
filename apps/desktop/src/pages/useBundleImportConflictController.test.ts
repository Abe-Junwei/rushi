import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../tauri/projectApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tauri/projectApi")>();
  return {
    ...actual,
    importExchangeBundlePreview: vi.fn(),
    importExchangeBundleApply: vi.fn(),
  };
});

vi.mock("../services/ui/toast", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { importExchangeBundlePreview, importExchangeBundleApply } from "../tauri/projectApi";
import { toast } from "../services/ui/toast";
import {
  useBundleImportConflictController,
  type BundleImportConflictDeps,
} from "./useBundleImportConflictController";
import type { ExchangeBundleImportPreview, ProjectDetail } from "../tauri/projectApi";

function makeDeps(overrides: Partial<BundleImportConflictDeps> = {}): BundleImportConflictDeps {
  return {
    setError: vi.fn(),
    beginBusy: vi.fn(),
    endBusy: vi.fn(),
    applyDetail: vi.fn(),
    refreshProjects: vi.fn(async () => {}),
    ...overrides,
  };
}

const project: ProjectDetail = {
  id: "proj-1",
  name: "示例项目",
  audio_storage_path: "",
  created_at_ms: 1,
  updated_at_ms: 1,
  segments: [],
  files: [],
};

const preview: ExchangeBundleImportPreview = {
  zipPath: "/tmp/bundle.zip",
  kind: "rushi_project_bundle",
  conflicts: [
    {
      id: "c0",
      incomingName: "开示",
      suggestedName: "开示 (2)",
      existingFileId: "f1",
      existingProjectId: "p1",
      existingProjectName: "旧项目",
      sourceProjectLabel: "导入项目",
      sourceKey: "src1",
    },
  ],
};

describe("useBundleImportConflictController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies immediately without opening the dialog when no conflicts", async () => {
    vi.mocked(importExchangeBundlePreview).mockResolvedValue({
      zipPath: "/tmp/clean.zip",
      kind: "rushi_project_bundle",
      conflicts: [],
    });
    vi.mocked(importExchangeBundleApply).mockResolvedValue({
      project,
      importedCount: 1,
      failedCount: 0,
      failedLabels: [],
      lexiconWarning: null,
    });
    const deps = makeDeps();
    const { result } = renderHook(() => useBundleImportConflictController(deps));

    await act(async () => {
      await result.current.importProjectBundle();
    });

    expect(importExchangeBundleApply).toHaveBeenCalledWith("/tmp/clean.zip", []);
    expect(result.current.bundleImportConflictPending).toBeNull();
    expect(deps.applyDetail).toHaveBeenCalledWith(project);
    expect(toast.success).toHaveBeenCalledWith("已导入内容包");
  });

  it("opens the conflict dialog with default drafts when conflicts are found", async () => {
    vi.mocked(importExchangeBundlePreview).mockResolvedValue(preview);
    const deps = makeDeps();
    const { result } = renderHook(() => useBundleImportConflictController(deps));

    await act(async () => {
      await result.current.importProjectBundle();
    });

    expect(importExchangeBundleApply).not.toHaveBeenCalled();
    expect(result.current.bundleImportConflictPending).toEqual(preview);
    expect(result.current.bundleImportConflictDrafts.c0).toEqual({
      action: "overwrite",
      renameTo: "开示 (2)",
    });
  });

  it("confirmBundleImportConflict applies resolutions and clears pending state", async () => {
    vi.mocked(importExchangeBundlePreview).mockResolvedValue(preview);
    vi.mocked(importExchangeBundleApply).mockResolvedValue({
      project,
      importedCount: 1,
      failedCount: 0,
      failedLabels: [],
      lexiconWarning: null,
    });
    const deps = makeDeps();
    const { result } = renderHook(() => useBundleImportConflictController(deps));

    await act(async () => {
      await result.current.importProjectBundle();
    });
    act(() => {
      result.current.setBundleImportConflictDraft("c0", { action: "rename", renameTo: "改名后" });
    });
    await act(async () => {
      await result.current.confirmBundleImportConflict();
    });

    expect(importExchangeBundleApply).toHaveBeenCalledWith("/tmp/bundle.zip", [
      { id: "c0", action: "rename", renameTo: "改名后" },
    ]);
    expect(result.current.bundleImportConflictPending).toBeNull();
    expect(result.current.bundleImportConflictDrafts).toEqual({});
  });

  it("cancelBundleImportConflict clears pending state without applying", async () => {
    vi.mocked(importExchangeBundlePreview).mockResolvedValue(preview);
    const deps = makeDeps();
    const { result } = renderHook(() => useBundleImportConflictController(deps));

    await act(async () => {
      await result.current.importProjectBundle();
    });
    act(() => {
      result.current.cancelBundleImportConflict();
    });

    expect(importExchangeBundleApply).not.toHaveBeenCalled();
    expect(result.current.bundleImportConflictPending).toBeNull();
    expect(result.current.bundleImportConflictDrafts).toEqual({});
  });
});
