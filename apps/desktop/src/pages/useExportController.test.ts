import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail, SegmentDto } from "../tauri/projectApi";
import { useExportController } from "./useExportController";

vi.mock("../tauri/projectApi", () => ({
  exportTextFile: vi.fn(),
  exportProjectBundle: vi.fn(),
  importProjectBundle: vi.fn(),
}));

vi.mock("../tauri/exportDocxApi", () => ({
  exportDocx: vi.fn(),
}));

vi.mock("../tauri/diagnosticApi", () => ({
  exportDiagnosticBundle: vi.fn(),
}));

import { exportTextFile, exportProjectBundle } from "../tauri/projectApi";

function makeDeps(overrides: Partial<Parameters<typeof useExportController>[0]> = {}) {
  const segments: SegmentDto[] = [
    { uid: "s1", idx: 0, start_sec: 0, end_sec: 1.2, text: "第一句" },
  ];
  const current: ProjectDetail = {
    id: "proj-1",
    name: "示例项目",
    audio_storage_path: "/tmp/a.wav",
    created_at_ms: 0,
    updated_at_ms: 0,
    segments: [],
    files: [],
  };

  return {
    current,
    currentFileId: "file-1",
    segmentsRef: { current: segments },
    setError: vi.fn(),
    flushSegmentTextDrafts: vi.fn(),
    beginBusy: vi.fn(),
    endBusy: vi.fn(),
    refreshProjects: vi.fn(() => Promise.resolve(undefined)),
    applyDetail: vi.fn(),
    ...overrides,
  };
}

describe("useExportController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exportTextFile).mockResolvedValue(null);
    vi.mocked(exportProjectBundle).mockResolvedValue(null);
  });

  it("exportTxt writes formatted text via projectApi", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportTxt();
    });

    expect(deps.flushSegmentTextDrafts).toHaveBeenCalled();
    expect(exportTextFile).toHaveBeenCalledWith(
      "示例项目.txt",
      expect.stringContaining("第一句"),
    );
    expect(deps.setError).toHaveBeenCalledWith("");
  });

  it("exportProjectBundle errors when no file is open", async () => {
    const deps = makeDeps({ currentFileId: null });
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportProjectBundle();
    });

    expect(exportProjectBundle).not.toHaveBeenCalled();
    expect(deps.setError).toHaveBeenCalledWith("请先打开一个文件后再导出项目包");
  });

  it("exportProjectBundle invokes bundle export for open file", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportProjectBundle();
    });

    expect(exportProjectBundle).toHaveBeenCalledWith(
      "proj-1",
      "file-1",
      "示例项目.zip",
      expect.arrayContaining([expect.objectContaining({ text: "第一句" })]),
    );
  });
});
