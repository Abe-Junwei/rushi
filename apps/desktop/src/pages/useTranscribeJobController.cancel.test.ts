import "./transcribeJobController.testSetup";
import {
  baseTranscribeJobDeps,
  loopbackFetch,
  resetTranscribeJobControllerTests,
  transcribeJobTestApi,
  transcribeTestSeg,
} from "./transcribeJobController.testHelpers";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushTranscribeHintsToToast } from "../services/ui/toast";
import { useTranscribeJobController } from "./useTranscribeJobController";

const { projectTranscribeAsyncFinalize } = transcribeJobTestApi();

describe("useTranscribeJobController cancel", () => {
  beforeEach(() => {
    resetTranscribeJobControllerTests();
  });

  it("restores segments and shows hint when user cancels transcribe", async () => {
    let releaseFirstPoll: (() => void) | null = null;
    let pollCount = 0;
    vi.mocked(loopbackFetch).mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/transcribe/cancel")) {
        return new Response(JSON.stringify({ cancelled: true }), { status: 200 });
      }
      pollCount += 1;
      if (pollCount === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstPoll = resolve;
        });
        return new Response(
          JSON.stringify({ phase: "transcribing", window_count: 3, window_index: 1 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ phase: "cancelled" }), { status: 200 });
    });

    const existing = [transcribeTestSeg("转写前")];
    const setError = vi.fn();
    const deps = baseTranscribeJobDeps({
      segments: existing,
      segmentsRef: { current: [...existing] },
      setError,
    });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    act(() => {
      result.current.confirmTranscribeOverwrite();
    });

    await act(async () => {
      while (!releaseFirstPoll) {
        await new Promise((r) => setTimeout(r, 5));
      }
    });

    await act(async () => {
      await result.current.cancelTranscribe();
      releaseFirstPoll?.();
    });

    await waitFor(() => {
      expect(pushTranscribeHintsToToast).toHaveBeenCalledWith(["已停止转写，语段已恢复。"]);
    });
    expect(projectTranscribeAsyncFinalize).not.toHaveBeenCalled();
    expect(setError.mock.calls.some(([msg]) => typeof msg === "string" && msg.length > 0)).toBe(false);
    expect(deps.endBusy).toHaveBeenCalled();
  });
});
