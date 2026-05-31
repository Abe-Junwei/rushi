import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { useTranscribeJobController } from "./useTranscribeJobController";

const projectRunTranscribe = vi.fn();
const projectLoad = vi.fn();

vi.mock("../tauri/projectApi", () => ({
  projectRunTranscribe: (...args: unknown[]) => projectRunTranscribe(...args),
  projectLoad: (...args: unknown[]) => projectLoad(...args),
}));

vi.mock("../config/env", () => ({
  asrBaseUrl: () => "http://127.0.0.1:8741",
}));

vi.mock("../services/stt/sttOnlineProviderContract", () => ({
  isSttOnlineEnabledButIncomplete: () => false,
  tryBuildOnlineTranscribeBridgePayload: () => null,
}));

function seg(text: string): SegmentDto {
  return {
    uid: "u1",
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  };
}

function baseDeps(overrides: Partial<Parameters<typeof useTranscribeJobController>[0]> = {}) {
  const segments = overrides.segments ?? [seg("已有正文")];
  const segmentsRef = { current: segments };
  return {
    busy: false,
    beginBusy: vi.fn(),
    endBusy: vi.fn(),
    current: { id: "proj-1", name: "P", files: [], created_at_ms: 0, updated_at_ms: 0 },
    currentFileId: "file-1",
    segments,
    segmentsRef,
    setCurrent: vi.fn(),
    setError: vi.fn(),
    closeGate: { openFileWrapped: vi.fn(async () => {}) },
    mutations: { resetMutationHistory: vi.fn() },
    localTranscribePreflight: () => null,
    ...overrides,
  };
}

describe("useTranscribeJobController", () => {
  beforeEach(() => {
    projectRunTranscribe.mockReset();
    projectLoad.mockReset();
  });

  it("opens overwrite dialog when segments have non-empty text", async () => {
    const deps = baseDeps();
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });

    expect(result.current.overwriteDialogOpen).toBe(true);
    expect(projectRunTranscribe).not.toHaveBeenCalled();
  });

  it("blocks transcribe when local preflight returns a message", async () => {
    const setError = vi.fn();
    const deps = baseDeps({
      segments: [],
      segmentsRef: { current: [] },
      setError,
      localTranscribePreflight: () => "本机 ASR 未就绪",
    });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });

    expect(setError).toHaveBeenCalledWith("本机 ASR 未就绪");
    expect(projectRunTranscribe).not.toHaveBeenCalled();
  });

  it("runs transcribe when segments are empty", async () => {
    projectRunTranscribe.mockResolvedValue({
      engine: "funasr",
      warnings: [],
      detail: { segments: [seg("新语段")] },
    });
    projectLoad.mockResolvedValue({ id: "proj-1", name: "P", files: [], created_at_ms: 0, updated_at_ms: 0 });

    const deps = baseDeps({ segments: [], segmentsRef: { current: [] } });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });

    expect(projectRunTranscribe).toHaveBeenCalled();
    expect(result.current.overwriteDialogOpen).toBe(false);
    expect(deps.beginBusy).toHaveBeenCalledWith("transcribe");
    expect(deps.endBusy).toHaveBeenCalled();
  });

  it("confirmTranscribeOverwrite closes dialog before transcribe finishes", async () => {
    let resolveTranscribe!: (value: unknown) => void;
    projectRunTranscribe.mockReturnValue(
      new Promise((resolve) => {
        resolveTranscribe = resolve;
      }),
    );
    projectLoad.mockResolvedValue({
      id: "proj-1",
      name: "P",
      files: [],
      audio_storage_path: "",
      segments: [],
      created_at_ms: 0,
      updated_at_ms: 0,
    });

    const deps = baseDeps();
    const { result } = renderHook(() => useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]));

    await act(async () => {
      await result.current.requestTranscribe();
    });
    expect(result.current.overwriteDialogOpen).toBe(true);

    await act(async () => {
      result.current.confirmTranscribeOverwrite();
    });

    expect(projectRunTranscribe).toHaveBeenCalled();
    expect(result.current.overwriteDialogOpen).toBe(false);

    await act(async () => {
      resolveTranscribe({
        engine: "funasr",
        warnings: [],
        detail: { segments: [seg("覆盖后")] },
      });
      await Promise.resolve();
    });
    expect(deps.endBusy).toHaveBeenCalled();
  });
});
