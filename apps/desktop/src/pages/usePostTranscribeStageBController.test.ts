import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { toast } from "../services/ui/toast";
import { readStageBLlmGateSnapshot, ensureStageBLlmActionReady, resolveStageBSyncBlockReason } from "../services/postprocess/stageBLlmGate";
import { resolvePendingStageAHint } from "../services/postprocess/stageBPendingRulesHint";
import { runPostTranscribeStageBPreview } from "../services/postprocess/postTranscribeStageB";
import { markLlmConnectionVerified, tryBuildPostprocessRuntimeBridge } from "../services/postprocess/postprocessRuntimeContract";
import { usePostTranscribeStageBController } from "./usePostTranscribeStageBController";

vi.mock("../services/postprocess/stageBLlmGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/postprocess/stageBLlmGate")>();
  return {
    ...actual,
    readStageBLlmGateSnapshot: vi.fn(),
    resolveStageBSyncBlockReason: vi.fn(),
    ensureStageBLlmActionReady: vi.fn(),
  };
});

vi.mock("../services/postprocess/postprocessRuntimeContract", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../services/postprocess/postprocessRuntimeContract")
  >();
  return {
    ...actual,
    tryBuildPostprocessRuntimeBridge: vi.fn(),
    markLlmConnectionVerified: vi.fn(),
  };
});

vi.mock("../services/postprocess/stageBPendingRulesHint", () => ({
  resolvePendingStageAHint: vi.fn(),
}));

vi.mock("../services/postprocess/postTranscribeStageB", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/postprocess/postTranscribeStageB")>();
  return {
    ...actual,
    runPostTranscribeStageBPreview: vi.fn(),
  };
});

vi.mock("../services/ui/toast", () => ({
  toast: { warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("../utils/segmentListVirtualWindow", () => ({
  scrollSegmentListIndexToView: vi.fn(),
}));

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

function baseArgs() {
  const segments: SegmentDto[] = [
    { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "测试语段" },
  ];
  const segmentsRef = { current: segments };
  return {
    busy: false,
    transcribePreviewActive: false,
    currentFileId: "file-1",
    segments,
    segmentsRef,
    flushSegmentTextDrafts: vi.fn(),
    setSegments: vi.fn(),
    setSelectedIdx: vi.fn(),
    pushUndo: vi.fn(),
    setError: vi.fn(),
    saveSegments: vi.fn().mockResolvedValue(true),
    llmRuntimeEpoch: 0,
    beginBusy: vi.fn(),
    endBusy: vi.fn(),
  };
}

describe("usePostTranscribeStageBController", () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
    vi.mocked(toast.warning).mockClear();
    vi.mocked(readStageBLlmGateSnapshot).mockReturnValue({
      llmCapabilityOk: true,
      llmCapabilityBlockReason: null,
      keychainReady: true,
      keychainChecking: false,
    });
    vi.mocked(resolveStageBSyncBlockReason).mockReturnValue(null);
    vi.mocked(ensureStageBLlmActionReady).mockResolvedValue(null);
    vi.mocked(resolvePendingStageAHint).mockResolvedValue(null);
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKeyId: "default",
    });
    vi.mocked(runPostTranscribeStageBPreview).mockReset();
    vi.mocked(markLlmConnectionVerified).mockClear();
  });

  it("offerPostTranscribeStageB shows warning toast when LLM gate blocks", async () => {
    vi.mocked(readStageBLlmGateSnapshot).mockReturnValue({
      llmCapabilityOk: false,
      llmCapabilityBlockReason: "本机 LLM 尚未就绪",
      keychainReady: true,
      keychainChecking: false,
    });
    vi.mocked(resolveStageBSyncBlockReason).mockReturnValue(null);
    const args = baseArgs();
    const { result } = renderHook(() => usePostTranscribeStageBController(args));

    await act(async () => {
      await result.current.offerPostTranscribeStageB();
    });

    expect(toast.warning).toHaveBeenCalledWith("本机 LLM 尚未就绪");
    expect(result.current.postTranscribeStageBDialog).toEqual({ phase: "closed" });
  });

  it("offerPostTranscribeStageB opens consent when LLM ready and consent not accepted", async () => {
    const args = baseArgs();
    const { result } = renderHook(() => usePostTranscribeStageBController(args));

    await act(async () => {
      await result.current.offerPostTranscribeStageB();
    });

    expect(toast.warning).not.toHaveBeenCalled();
    expect(result.current.postTranscribeStageBDialog.phase).toBe("consent");
    if (result.current.postTranscribeStageBDialog.phase === "consent") {
      expect(result.current.postTranscribeStageBDialog.segmentCount).toBe(1);
    }
  });

  it("offerPostTranscribeStageB toasts file-level block reason without opening dialog", async () => {
    vi.mocked(resolveStageBSyncBlockReason).mockReturnValue("请先打开一个文件");
    const args = { ...baseArgs(), currentFileId: null };
    const { result } = renderHook(() => usePostTranscribeStageBController(args));

    await act(async () => {
      await result.current.offerPostTranscribeStageB();
    });

    expect(toast.warning).toHaveBeenCalledWith("请先打开一个文件");
    expect(result.current.postTranscribeStageBDialog).toEqual({ phase: "closed" });
  });

  it("offerPostTranscribeStageB toasts when keychain check fails before consent", async () => {
    vi.mocked(ensureStageBLlmActionReady).mockResolvedValue(
      "本地未找到已保存的 API Key，请在设置 → LLM 配置 中重新保存。",
    );
    const args = baseArgs();
    const { result } = renderHook(() => usePostTranscribeStageBController(args));

    await act(async () => {
      await result.current.offerPostTranscribeStageB();
    });

    expect(toast.warning).toHaveBeenCalledWith(
      "本地未找到已保存的 API Key，请在设置 → LLM 配置 中重新保存。",
    );
    expect(result.current.postTranscribeStageBDialog).toEqual({ phase: "closed" });
  });

  it("startPreview does not mark connection verified when all batches fail", async () => {
    window.localStorage.setItem("rushi:auto-punctuate-consent:v1", "1");
    vi.mocked(runPostTranscribeStageBPreview).mockResolvedValue({
      changes: [],
      typoStepError: "网络错误",
      provider: "deepseek",
      rejectedBoundaryOps: 0,
      droppedUngroundedOps: 0,
      packTruncationHint: null,
    });
    const args = baseArgs();
    const { result } = renderHook(() => usePostTranscribeStageBController(args));

    await act(async () => {
      await result.current.offerPostTranscribeStageB();
    });
    act(() => {
      result.current.confirmPostTranscribeStageBConsent();
    });

    expect(markLlmConnectionVerified).not.toHaveBeenCalled();
    expect(result.current.postTranscribeStageBDialog.phase).toBe("empty");
  });

  it("startPreview marks connection verified when preview succeeds", async () => {
    window.localStorage.setItem("rushi:auto-punctuate-consent:v1", "1");
    vi.mocked(runPostTranscribeStageBPreview).mockResolvedValue({
      changes: [
        {
          segmentIdx: 0,
          segmentNumber: 1,
          timeLabel: "00:00",
          uid: "s1",
          beforeText: "测试语段",
          afterText: "测试语段。",
          diff: [],
          punctuateTouched: true,
          typoTouched: false,
          evidenceSummary: null,
        },
      ],
      typoStepError: null,
      provider: "deepseek",
      rejectedBoundaryOps: 0,
      droppedUngroundedOps: 0,
      packTruncationHint: null,
    });
    const args = baseArgs();
    const { result } = renderHook(() => usePostTranscribeStageBController(args));

    await act(async () => {
      await result.current.offerPostTranscribeStageB();
    });
    act(() => {
      result.current.confirmPostTranscribeStageBConsent();
    });

    expect(markLlmConnectionVerified).toHaveBeenCalledTimes(1);
    expect(result.current.postTranscribeStageBDialog.phase).toBe("preview");
  });
});
