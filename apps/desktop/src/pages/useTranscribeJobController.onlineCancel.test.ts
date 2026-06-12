import "./transcribeJobController.testSetup";
import {
  baseTranscribeJobDeps,
  resetTranscribeJobControllerTests,
  transcribeJobTestApi,
  transcribeTestSeg,
} from "./transcribeJobController.testHelpers";
import * as sttContract from "../services/stt/sttOnlineProviderContract";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushTranscribeHintsToToast } from "../services/ui/toast";
import { useTranscribeJobController } from "./useTranscribeJobController";

describe("useTranscribeJobController online cancel", () => {
  const { projectRunTranscribe, projectCancelTranscribe } = transcribeJobTestApi();

  beforeEach(() => {
    resetTranscribeJobControllerTests();
    vi.mocked(sttContract.isOnlineTranscribeReady).mockReturnValue(true);
    vi.mocked(sttContract.tryBuildOnlineTranscribeBridgePayload).mockReturnValue({
      transcribeUrl: "https://api.openai.com/v1/audio/transcriptions",
      nativeAdapter: "openaiAudio",
    });
    vi.mocked(sttContract.ensureSttOnlineApiKeyForSession).mockResolvedValue(true);
    vi.spyOn(sttContract, "resolveOnlineTranscribeBlock").mockReturnValue(null);
  });

  it("calls projectCancelTranscribe and restores segments when online invoke aborts", async () => {
    let releaseRun: (() => void) | null = null;
    let capturedRequestId = "";
    projectRunTranscribe.mockImplementation(
      (_pid, _fid, _bridge, requestId: string) =>
        new Promise((_resolve, reject) => {
          capturedRequestId = requestId;
          releaseRun = () => reject(new Error("转写已取消"));
        }),
    );
    projectCancelTranscribe.mockImplementation(() => {
      releaseRun?.();
      return Promise.resolve(true);
    });

    const existing = [transcribeTestSeg("转写前")];
    const deps = baseTranscribeJobDeps({
      segments: existing,
      segmentsRef: { current: [...existing] },
    });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    act(() => {
      result.current.setTranscribeSource("online");
    });

    act(() => {
      void result.current.confirmTranscribeStart();
    });

    await waitFor(() => {
      expect(projectRunTranscribe).toHaveBeenCalled();
      expect(capturedRequestId.startsWith("online-stt-")).toBe(true);
    });

    await act(async () => {
      await result.current.cancelTranscribe();
    });

    await waitFor(() => {
      expect(projectCancelTranscribe).toHaveBeenCalledWith(capturedRequestId);
      expect(pushTranscribeHintsToToast).toHaveBeenCalledWith(["已停止转写，语段已恢复。"]);
    });
    expect(deps.endBusy).toHaveBeenCalled();
  });
});
