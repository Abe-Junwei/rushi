import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBatchTranscribeQueueController } from "./useBatchTranscribeQueueController";
import type { ExecuteTranscribeResult } from "./useTranscribeJobExecute";
import type { FileSummary } from "../tauri/projectTypes";

vi.mock("../services/ui/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../tauri/fileApi", () => ({
  loadFile: vi.fn(),
}));

import { toast } from "../services/ui/toast";
import * as fileApi from "../tauri/fileApi";

function file(partial: Partial<FileSummary> & Pick<FileSummary, "id" | "name" | "file_type">): FileSummary {
  return { updated_at_ms: 0, ...partial };
}

function makeDeps(
  overrides: Partial<Parameters<typeof useBatchTranscribeQueueController>[0]> = {},
) {
  const beginBusy = vi.fn();
  const endBusy = vi.fn();
  const openFileWrapped = vi.fn(() => Promise.resolve());
  const cancelTranscribe = vi.fn(() => Promise.resolve());
  const executeTranscribeForBatch = vi.fn(
    (): Promise<ExecuteTranscribeResult> => Promise.resolve({ ok: true }),
  );
  const setError = vi.fn();
  const refreshProjectHub = vi.fn(() => Promise.resolve());

  return {
    deps: {
      projectId: "proj-1",
      projectFiles: [file({ id: "f1", name: "a.wav", file_type: "paired" })],
      busy: false,
      hasUnsavedSegmentChanges: () => false,
      beginBusy,
      endBusy,
      openFileWrapped,
      cancelTranscribe,
      executeTranscribeForBatch,
      localTranscribePreflight: () => null,
      transcribeSource: "local" as const,
      setError,
      refreshProjectHub,
      ...overrides,
    },
    beginBusy,
    endBusy,
    openFileWrapped,
    executeTranscribeForBatch,
    setError,
    refreshProjectHub,
  };
}

describe("useBatchTranscribeQueueController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fileApi.loadFile).mockResolvedValue({
      segments: [],
    } as never);
  });

  it("marks failed when execute returns not ok without throwing", async () => {
    const { deps, executeTranscribeForBatch } = makeDeps();
    executeTranscribeForBatch.mockResolvedValue({ ok: false, message: "本机 ASR 未就绪" });

    const { result } = renderHook(() => useBatchTranscribeQueueController(deps));

    await act(async () => {
      await result.current.startBatchTranscribe();
    });

    expect(executeTranscribeForBatch).toHaveBeenCalledWith({
      batchChild: true,
      fileId: "f1",
      suppressUserToasts: true,
    });
    expect(result.current.batchQueueItems[0]?.status).toBe("failed");
    expect(result.current.batchQueueItems[0]?.detail).toBe("本机 ASR 未就绪");
    expect(toast.success).toHaveBeenCalled();
  });

  it("passes explicit fileId even when openFileWrapped is used", async () => {
    const { deps, executeTranscribeForBatch, openFileWrapped } = makeDeps({
      projectFiles: [
        file({ id: "f1", name: "a.wav", file_type: "paired" }),
        file({ id: "f2", name: "b.wav", file_type: "paired", updated_at_ms: 1 }),
      ],
    });
    vi.mocked(fileApi.loadFile).mockImplementation((id) =>
      Promise.resolve({
        segments: id === "f2" ? [{ idx: 0, start_sec: 0, end_sec: 1, text: "已有" }] : [],
      } as never),
    );

    const { result } = renderHook(() => useBatchTranscribeQueueController(deps));

    await act(async () => {
      await result.current.startBatchTranscribe();
    });

    expect(openFileWrapped).toHaveBeenCalledWith("f1");
    expect(executeTranscribeForBatch).toHaveBeenCalledTimes(1);
    expect(result.current.batchQueueItems.find((i) => i.fileId === "f2")?.status).toBe("skipped");
  });
});
