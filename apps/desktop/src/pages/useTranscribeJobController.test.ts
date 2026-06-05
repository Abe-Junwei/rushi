import "./transcribeJobController.testSetup";
import {
  baseTranscribeJobDeps,
  resetTranscribeJobControllerTests,
  transcribeJobTestApi,
  transcribeTestSeg,
} from "./transcribeJobController.testHelpers";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranscribeJobController } from "./useTranscribeJobController";

const { projectTranscribeAsyncStart, projectTranscribeAsyncFinalize, projectRunTranscribe } =
  transcribeJobTestApi();

describe("useTranscribeJobController", () => {
  beforeEach(() => {
    resetTranscribeJobControllerTests();
  });

  it("opens start dialog when segments have non-empty text", async () => {
    const deps = baseTranscribeJobDeps();
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });

    expect(result.current.transcribeStartDialogOpen).toBe(true);
    expect(result.current.transcribeStartHasExistingText).toBe(true);
    expect(projectTranscribeAsyncStart).not.toHaveBeenCalled();
  });

  it("blocks transcribe when local preflight returns a message on confirm", async () => {
    const setError = vi.fn();
    const deps = baseTranscribeJobDeps({
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
    expect(result.current.transcribeStartDialogOpen).toBe(true);

    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(setError).toHaveBeenCalledWith("本机 ASR 未就绪");
    expect(projectTranscribeAsyncStart).not.toHaveBeenCalled();
  });

  it("runs async transcribe after confirm when segments are empty", async () => {
    const deps = baseTranscribeJobDeps({ segments: [], segmentsRef: { current: [] } });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    expect(result.current.transcribeStartDialogOpen).toBe(true);

    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(projectTranscribeAsyncStart).toHaveBeenCalled();
    expect(projectTranscribeAsyncFinalize).toHaveBeenCalled();
    expect(projectRunTranscribe).not.toHaveBeenCalled();
    expect(result.current.transcribeStartDialogOpen).toBe(false);
    expect(deps.beginBusy).toHaveBeenCalledWith("transcribe");
    expect(deps.endBusy).toHaveBeenCalled();
  });

  it("confirmTranscribeStart closes dialog before transcribe finishes", async () => {
    let resolveFinalize!: (value: unknown) => void;
    projectTranscribeAsyncFinalize.mockReturnValue(
      new Promise((resolve) => {
        resolveFinalize = resolve;
      }),
    );

    const deps = baseTranscribeJobDeps();
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    expect(result.current.transcribeStartDialogOpen).toBe(true);

    act(() => {
      void result.current.confirmTranscribeStart();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(projectTranscribeAsyncStart).toHaveBeenCalled();
    expect(result.current.transcribeStartDialogOpen).toBe(false);

    await act(async () => {
      resolveFinalize({
        engine: "funasr",
        warnings: [],
        detail: { segments: [transcribeTestSeg("覆盖后")] },
      });
      await Promise.resolve();
    });
    expect(deps.endBusy).toHaveBeenCalled();
  });
});
