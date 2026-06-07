import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  persistLlmRuntimeConfig,
  applyLlmProviderPreset,
  setLlmApiKeyInMemory,
} from "../services/postprocess/postprocessRuntimeContract";
import { useAutoPunctuateController } from "./useAutoPunctuateController";

type MockPostprocess = (req: unknown) => Promise<{
  text: string;
  diff: { start: number; end: number; kind: "insert" | "delete" | "replace" }[];
  provider: string;
  latency_ms: number;
}>;

const postprocessAutoPunctuate = vi.fn<MockPostprocess>();
const postprocessCancelAutoPunctuate = vi.fn<(requestId: string) => Promise<boolean>>();

vi.mock("../tauri/postprocessApi", () => ({
  postprocessAutoPunctuate: (req: unknown) => postprocessAutoPunctuate(req),
  postprocessCancelAutoPunctuate: (requestId: string) => postprocessCancelAutoPunctuate(requestId),
}));

function seg(text: string, uid = "seg-1"): SegmentDto {
  return {
    uid,
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

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

describe("useAutoPunctuateController", () => {
  beforeEach(() => {
    postprocessAutoPunctuate.mockReset();
    postprocessCancelAutoPunctuate.mockReset();
    postprocessCancelAutoPunctuate.mockResolvedValue(true);
    installMockLocalStorage();
    window.localStorage.clear();
    setLlmApiKeyInMemory(null);
  });

  function seedDeepseekRuntime() {
    persistLlmRuntimeConfig(applyLlmProviderPreset("deepseek"));
    setLlmApiKeyInMemory("sk-test");
  }

  it("opens consent before the first request", () => {
    seedDeepseekRuntime();
    const segmentsRef = { current: [seg("你好世界")] };
    const updateSegmentText = vi.fn();
    const setError = vi.fn();
    const { result } = renderHook(() =>
      useAutoPunctuateController({
        busy: false,
        currentFileId: "f1",
        selectedIdx: 0,
        segments: segmentsRef.current,
        segmentsRef,
        flushSegmentTextDrafts: vi.fn(),
        updateSegmentText,
        setError,
      }),
    );

    act(() => {
      result.current.requestAutoPunctuate();
    });

    expect(result.current.dialog.phase).toBe("consent");
    expect(postprocessAutoPunctuate).not.toHaveBeenCalled();
    expect(updateSegmentText).not.toHaveBeenCalled();
  });

  it("includes neighbor_context when adjacent segments have text", async () => {
    seedDeepseekRuntime();
    window.localStorage.setItem("rushi:auto-punctuate-consent:v1", "accepted");
    const segmentsRef = {
      current: [
        seg("前一句。", "seg-prev"),
        seg("中间没有标点", "seg-mid"),
        seg("后一句。", "seg-next"),
      ],
    };
    postprocessAutoPunctuate.mockResolvedValue({
      text: "中间，没有标点。",
      diff: [],
      provider: "openai-compatible",
      latency_ms: 50,
    });

    const { result } = renderHook(() =>
      useAutoPunctuateController({
        busy: false,
        currentFileId: "f1",
        selectedIdx: 1,
        segments: segmentsRef.current,
        segmentsRef,
        flushSegmentTextDrafts: vi.fn(),
        updateSegmentText: vi.fn(),
        setError: vi.fn(),
      }),
    );

    act(() => {
      result.current.requestAutoPunctuate();
    });

    await waitFor(() => {
      expect(result.current.dialog.phase).toBe("preview");
    });

    const request = postprocessAutoPunctuate.mock.calls[0]?.[0] as {
      neighbor_context?: { role: string; text: string }[];
    };
    expect(request.neighbor_context).toEqual([
      { role: "prev", text: "前一句。" },
      { role: "next", text: "后一句。" },
    ]);
    if (result.current.dialog.phase === "preview") {
      expect(result.current.dialog.neighborContextSummary).toBe(
        "含邻段上下文（上一语段、下一语段）",
      );
    }
  });

  it("writes back preview text after consent", async () => {
    seedDeepseekRuntime();
    const segmentsRef = { current: [seg("你好世界", "seg-a")] };
    const updateSegmentText = vi.fn((idx: number, text: string) => {
      segmentsRef.current[idx] = { ...segmentsRef.current[idx], text };
    });
    postprocessAutoPunctuate.mockResolvedValue({
      text: "你好，世界。",
      diff: [{ start: 2, end: 6, kind: "replace" }],
      provider: "openai-compatible",
      latency_ms: 123,
    });

    const { result } = renderHook(() =>
      useAutoPunctuateController({
        busy: false,
        currentFileId: "f1",
        selectedIdx: 0,
        segments: segmentsRef.current,
        segmentsRef,
        flushSegmentTextDrafts: vi.fn(),
        updateSegmentText,
        setError: vi.fn(),
      }),
    );

    act(() => {
      result.current.requestAutoPunctuate();
    });
    act(() => {
      result.current.confirmAutoPunctuateConsent();
    });

    await waitFor(() => {
      expect(result.current.dialog.phase).toBe("preview");
    });

    act(() => {
      result.current.confirmAutoPunctuateWriteback();
    });

    expect(updateSegmentText).toHaveBeenCalledWith(0, "你好，世界。", { fromLlm: true });
    expect(result.current.dialog.phase).toBe("closed");
  });

  it("cancels an in-flight request in the Tauri backend", () => {
    seedDeepseekRuntime();
    const segmentsRef = { current: [seg("今天天气不错我们出发吧", "seg-b")] };
    let resolve: ((value: Awaited<ReturnType<MockPostprocess>>) => void) | null =
      null;
    postprocessAutoPunctuate.mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<MockPostprocess>>>((r) => {
          resolve = r;
        }),
    );

    window.localStorage.setItem("rushi:auto-punctuate-consent:v1", "accepted");

    const { result } = renderHook(() =>
      useAutoPunctuateController({
        busy: false,
        currentFileId: "f1",
        selectedIdx: 0,
        segments: segmentsRef.current,
        segmentsRef,
        flushSegmentTextDrafts: vi.fn(),
        updateSegmentText: vi.fn(),
        setError: vi.fn(),
      }),
    );

    act(() => {
      result.current.requestAutoPunctuate();
    });
    expect(result.current.dialog.phase).toBe("loading");

    act(() => {
      result.current.cancelAutoPunctuate();
    });
    expect(result.current.dialog.phase).toBe("closed");
    const request = postprocessAutoPunctuate.mock.calls[0]?.[0] as { request_id?: string };
    expect(request.request_id).toBeTruthy();
    expect(postprocessCancelAutoPunctuate).toHaveBeenCalledWith(request.request_id);

    act(() => {
      resolve?.({
        text: "今天天气不错，我们出发吧。",
        diff: [{ start: 6, end: 12, kind: "replace" }],
        provider: "openai-compatible",
        latency_ms: 88,
      });
    });

    expect(result.current.dialog.phase).toBe("closed");
  });

  it("blocks auto punctuate during transcribe preview with explicit reason", () => {
    seedDeepseekRuntime();
    const segmentsRef = { current: [seg("你好世界")] };
    const { result } = renderHook(() =>
      useAutoPunctuateController({
        busy: true,
        transcribePreviewActive: true,
        currentFileId: "file-1",
        selectedIdx: 0,
        segments: segmentsRef.current,
        segmentsRef,
        flushSegmentTextDrafts: vi.fn(),
        updateSegmentText: vi.fn(),
        setError: vi.fn(),
        llmKeychainReady: true,
      }),
    );

    expect(result.current.canAutoPunctuate).toBe(false);
    expect(result.current.autoPunctuateBlockReason).toContain("转写预览中");
  });
});
