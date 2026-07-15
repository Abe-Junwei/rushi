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

vi.mock("../services/ui/pushActivity", () => ({
  pushExportFailureActivity: vi.fn(),
}));

vi.mock("../services/ui/toast", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    errorFromUnknown: vi.fn(),
  },
}));

import { exportTextFile, exportProjectBundle } from "../tauri/projectApi";
import { exportDocx as exportDocxImpl } from "../tauri/exportDocxApi";
import { exportDiagnosticBundle as exportDiagnosticBundleImpl } from "../tauri/diagnosticApi";
import { toast } from "../services/ui/toast";

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
    files: [
      {
        id: "file-1",
        name: "访谈录音",
        file_type: "paired",
        updated_at_ms: 0,
      },
    ],
  };

  return {
    current,
    currentFileId: "file-1",
    audioStoragePath: "/tmp/访谈录音.wav",
    getCurrentSegmentsSnapshot: () => segments,
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
      "访谈录音.txt",
      expect.stringContaining("第一句"),
    );
    expect(deps.setError).toHaveBeenCalledWith("");
  });

  it("exportTxt falls back to project name when no file is open", async () => {
    const deps = makeDeps({ currentFileId: null });
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportTxt();
    });

    expect(exportTextFile).toHaveBeenCalledWith(
      "示例项目.txt",
      expect.stringContaining("第一句"),
    );
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
      "访谈录音.zip",
      expect.arrayContaining([expect.objectContaining({ text: "第一句" })]),
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
      expect.stringContaining("/tmp/rushi-diagnostic.zip"),
    );
  });

  it("exportDiagnosticBundle toasts info when user cancels save dialog", async () => {
    vi.mocked(exportDiagnosticBundleImpl).mockResolvedValue(null);
    const deps = makeDeps();
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportDiagnosticBundle();
    });

    expect(toast.info).toHaveBeenCalledWith("已取消导出诊断包");
  });

  it("exportDeliveryDocx passes segments with annotation to exportDocx", async () => {
    vi.mocked(exportDocxImpl).mockResolvedValue("/tmp/out.docx");
    const segments: SegmentDto[] = [
      {
        uid: "s1",
        idx: 0,
        start_sec: 0,
        end_sec: 1,
        text: "甲",
        annotation: "存疑",
      },
    ];
    const deps = makeDeps({ getCurrentSegmentsSnapshot: () => segments });
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportDeliveryDocx({
        mode: "verbatim",
        includeRevisionAppendix: false,
      });
    });

    expect(deps.flushSegmentTextDrafts).toHaveBeenCalled();
    expect(exportDocxImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "verbatim",
      expect.arrayContaining([
        expect.objectContaining({ text: "甲", annotation: "存疑" }),
      ]),
      expect.any(Object),
    );
  });

  it("exportDeliveryDocx uses the real audio file name for the DOCX footer, not the file label", async () => {
    vi.mocked(exportDocxImpl).mockResolvedValue("/tmp/out.docx");
    const deps = makeDeps({ audioStoragePath: "/Users/x/recordings/raw_2026-07-15.wav" });
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportDeliveryDocx({
        mode: "verbatim",
        includeRevisionAppendix: false,
      });
    });

    expect(exportDocxImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "verbatim",
      expect.any(Array),
      expect.objectContaining({ recordingFileName: "raw_2026-07-15.wav" }),
    );
  });

  it("exportDeliveryDocx falls back to the file label when no audio is attached", async () => {
    vi.mocked(exportDocxImpl).mockResolvedValue("/tmp/out.docx");
    const deps = makeDeps({ audioStoragePath: null });
    const { result } = renderHook(() => useExportController(deps));

    await act(async () => {
      await result.current.exportDeliveryDocx({
        mode: "verbatim",
        includeRevisionAppendix: false,
      });
    });

    expect(exportDocxImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "verbatim",
      expect.any(Array),
      expect.objectContaining({ recordingFileName: "访谈录音" }),
    );
  });
});
