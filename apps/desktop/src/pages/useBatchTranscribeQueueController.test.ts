import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBatchTranscribeQueueController } from "./useBatchTranscribeQueueController";
import type { ExecuteTranscribeResult } from "./useTranscribeJobExecute";
import type { FileSummary } from "../tauri/projectTypes";

vi.mock("../services/ui/pushActivity", () => ({
  pushBatchTranscribeSummaryActivity: vi.fn(),
}));

vi.mock("../services/ui/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("../tauri/fileApi", () => ({
  loadFile: vi.fn(),
}));

vi.mock("../services/stt/sttOnlineProviderContract", () => ({
  resolveOnlineTranscribeSessionBlock: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("../services/stt/transcribeSourcePresentation", () => ({
  resolveEffectiveTranscribeSource: vi.fn(
    (source: "local" | "online", options?: { onlineReady?: boolean }) =>
      options?.onlineReady === false ? "local" : source === "online" || options?.onlineReady ? "online" : source,
  ),
}));

import { pushBatchTranscribeSummaryActivity } from "../services/ui/pushActivity";
import { toast } from "../services/ui/toast";
import { resolveOnlineTranscribeSessionBlock } from "../services/stt/sttOnlineProviderContract";
import * as fileApi from "../tauri/fileApi";

function file(partial: Partial<FileSummary> & Pick<FileSummary, "id" | "name" | "file_type">): FileSummary {
  return { updated_at_ms: 0, ...partial };
}

function makeDeps(
  overrides: Partial<Parameters<typeof useBatchTranscribeQueueController>[0]> = {},
) {
  const beginBusy = vi.fn();
  const endBusy = vi.fn();
  const openFileForBatch = vi.fn(() => Promise.resolve());
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
      openFileForBatch,
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
    openFileForBatch,
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
    expect(pushBatchTranscribeSummaryActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-1",
        stopped: true,
      }),
    );
  });

  it("aborts before queue when online session key is missing", async () => {
    vi.mocked(resolveOnlineTranscribeSessionBlock).mockResolvedValueOnce(
      "在线 STT：本地密钥丢失，请到「环境 → 在线 STT」重新保存。",
    );
    const { deps, executeTranscribeForBatch, beginBusy, setError } = makeDeps({
      transcribeSource: "online",
      onlineTranscribeReady: true,
      projectFiles: [
        file({ id: "f1", name: "a.wav", file_type: "paired" }),
        file({ id: "f2", name: "b.wav", file_type: "paired", updated_at_ms: 1 }),
      ],
    });

    const { result } = renderHook(() => useBatchTranscribeQueueController(deps));

    await act(async () => {
      await result.current.startBatchTranscribe();
    });

    expect(beginBusy).not.toHaveBeenCalled();
    expect(executeTranscribeForBatch).not.toHaveBeenCalled();
    expect(pushBatchTranscribeSummaryActivity).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(expect.stringContaining("密钥丢失"));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("密钥丢失"));
    expect(result.current.batchTranscribeRunning).toBe(false);
  });

  it("stops remaining files after a shared env failure", async () => {
    const { deps, executeTranscribeForBatch } = makeDeps({
      projectFiles: [
        file({ id: "f1", name: "a.wav", file_type: "paired" }),
        file({ id: "f2", name: "b.wav", file_type: "paired", updated_at_ms: 1 }),
      ],
    });
    executeTranscribeForBatch.mockResolvedValue({
      ok: false,
      message: "在线 STT：本地密钥丢失，请重新保存。",
    });

    const { result } = renderHook(() => useBatchTranscribeQueueController(deps));

    await act(async () => {
      await result.current.startBatchTranscribe();
    });

    expect(executeTranscribeForBatch).toHaveBeenCalledTimes(1);
    // Newest-first: f2 runs first, then shared-env stop skips older f1.
    expect(result.current.batchQueueItems.find((i) => i.fileId === "f2")?.status).toBe("failed");
    expect(result.current.batchQueueItems.find((i) => i.fileId === "f1")?.status).toBe("skipped");
  });

  it("opens each batch file through the unguarded batch navigation", async () => {
    const { deps, executeTranscribeForBatch, openFileForBatch } = makeDeps({
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

    expect(openFileForBatch).toHaveBeenCalledWith("f1");
    expect(executeTranscribeForBatch).toHaveBeenCalledTimes(1);
    expect(result.current.batchQueueItems.find((i) => i.fileId === "f2")?.status).toBe("skipped");
  });

});
