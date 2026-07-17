import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../tauri/projectApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tauri/projectApi")>();
  return {
    ...actual,
    exportTextFile: vi.fn(),
    exportProjectBundle: vi.fn(),
    exportLibraryBundle: vi.fn(),
    importProjectBundle: vi.fn(),
  };
});

vi.mock("../tauri/diagnosticApi", () => ({
  exportDiagnosticBundle: vi.fn(),
}));

vi.mock("../services/ui/toast", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    errorFromUnknown: vi.fn(),
  },
}));

vi.mock("../services/onboarding/onboardingAutoSync", () => ({
  syncOnboardingExport: vi.fn(),
}));

import { exportTextFile, exportProjectBundle, exportLibraryBundle } from "../tauri/projectApi";
import { exportDiagnosticBundle as exportDiagnosticBundleImpl } from "../tauri/diagnosticApi";
import { toast } from "../services/ui/toast";
import { useExportController, type ExportDeps } from "./useExportController";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";

function makeDeps(overrides: Partial<ExportDeps> = {}): ExportDeps {
  const current: ProjectDetail = {
    id: "proj-1",
    name: "示例项目",
    audio_storage_path: "",
    created_at_ms: 1,
    updated_at_ms: 1,
    segments: [],
    files: [
      {
        id: "file-1",
        name: "访谈录音",
        file_type: "paired",
        updated_at_ms: 1,
      },
    ],
  };
  return {
    current,
    currentFileId: "file-1",
    audioStoragePath: null,
    getCurrentSegmentsSnapshot: () =>
      [
        {
          idx: 0,
          start_sec: 0,
          end_sec: 1,
          text: "第一句",
          low_confidence: false,
          text_stage: "auto_transcribe",
          frozen: false,
        },
      ] as SegmentDto[],
    setError: vi.fn(),
    flushSegmentTextDrafts: vi.fn(),
    beginBusy: vi.fn(),
    endBusy: vi.fn(),
    applyDetail: vi.fn(),
    refreshProjects: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("useExportController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exportTextFile).mockResolvedValue(null);
    vi.mocked(exportProjectBundle).mockResolvedValue(null);
    vi.mocked(exportLibraryBundle).mockResolvedValue(null);
  });

  it("exportProjectBundle opens scope chooser without invoking IPC", () => {
    const deps = makeDeps({ currentFileId: null });
    const { result } = renderHook(() => useExportController(deps));

    act(() => {
      result.current.exportProjectBundle();
    });

    expect(result.current.exportBundleScopeOpen).toBe(true);
    expect(result.current.exportBundleScope).toBe("library");
    expect(exportProjectBundle).not.toHaveBeenCalled();
  });

  it("confirmExportBundleScope exports current project when selected", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useExportController(deps));

    act(() => {
      result.current.exportProjectBundle();
    });
    await act(async () => {
      await result.current.confirmExportBundleScope();
    });

    expect(deps.beginBusy).toHaveBeenCalledWith("export");
    expect(deps.endBusy).toHaveBeenCalled();
    expect(exportProjectBundle).toHaveBeenCalledWith(
      "proj-1",
      "file-1",
      "访谈录音.zip",
      expect.arrayContaining([expect.objectContaining({ text: "第一句" })]),
    );
    expect(result.current.exportBundleScopeOpen).toBe(false);
  });

  it("confirmExportBundleScope exports library when selected", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useExportController(deps));

    act(() => {
      result.current.exportProjectBundle();
      result.current.setExportBundleScope("library");
    });
    await act(async () => {
      await result.current.confirmExportBundleScope();
    });

    expect(deps.beginBusy).toHaveBeenCalledWith("export");
    expect(deps.endBusy).toHaveBeenCalled();
    expect(exportLibraryBundle).toHaveBeenCalledWith(
      "rushi-library-bundle.zip",
      "proj-1",
      "file-1",
      expect.any(Array),
    );
  });

  it("exportTxt still works", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportTxt();
    });

    expect(exportTextFile).toHaveBeenCalledWith(
      "访谈录音.txt",
      expect.stringContaining("第一句"),
    );
  });

  it("exportDiagnosticBundle toasts success when user saves zip", async () => {
    vi.mocked(exportDiagnosticBundleImpl).mockResolvedValue("/tmp/rushi-diagnostic.zip");
    const deps = makeDeps();
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportDiagnosticBundle();
    });

    expect(deps.beginBusy).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("已导出诊断包"),
    );
  });
});
