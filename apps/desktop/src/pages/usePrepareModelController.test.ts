import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePrepareModelController } from "./usePrepareModelController";

const SELECTED_HUB =
  "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch";

function urlFromFetchInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function makeFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("usePrepareModelController", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps prepareModelBusy true while health precheck short-circuits", async () => {
    let refreshCallBusyState: boolean | null = null;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = urlFromFetchInput(input);
      if (url.includes("/health")) {
        return makeFetchResponse({
          status: "ok",
          service: "rushi-asr",
          ffmpeg_ok: true,
          funasr_import_ok: true,
          funasr_ready: true,
          funasr_model_id: SELECTED_HUB,
          ready_for_transcribe: true,
          selected_model_ready: true,
          transcription_mode: "funasr",
        });
      }
      return makeFetchResponse({}, 404);
    });

    const refreshAsrRuntimeInfo = vi.fn(async () => {
      refreshCallBusyState = renderHookResult.result.current.prepareModelBusy;
    });
    const getSelectedHubModelId = () => SELECTED_HUB;

    const renderHookResult = renderHook(() =>
      usePrepareModelController(refreshAsrRuntimeInfo, getSelectedHubModelId),
    );

    expect(renderHookResult.result.current.prepareModelBusy).toBe(false);

    await act(async () => {
      await renderHookResult.result.current.prepareDefaultFunasrModel();
    });

    // 预检命中缓存时会调用 refreshAsrRuntimeInfo；此时 busy 必须为 true，
    // 否则 buildAsrEnvPresentation 仍会用旧 caps 展示「已就绪」。
    expect(refreshAsrRuntimeInfo).toHaveBeenCalled();
    expect(refreshCallBusyState).toBe(true);
    // 完成后应清掉 busy
    expect(renderHookResult.result.current.prepareModelBusy).toBe(false);
  });

  it("does not use /health ready_for_transcribe to short-circuit idle after 4s", async () => {
    let healthCallCount = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = urlFromFetchInput(input);
      if (url.includes("/health")) {
        healthCallCount += 1;
        return makeFetchResponse({
          status: "ok",
          service: "rushi-asr",
          ffmpeg_ok: true,
          funasr_import_ok: true,
          funasr_ready: true,
          funasr_model_id: SELECTED_HUB,
          ready_for_transcribe: true,
          selected_model_ready: true,
          transcription_mode: "funasr",
        });
      }
      if (url.includes("/v1/models/prepare/async")) {
        return makeFetchResponse({ started: true, model_id: SELECTED_HUB });
      }
      if (url.includes("/v1/models/prepare-status")) {
        // Simulate orphan prepare: phase stays idle for longer than 4s.
        await new Promise((r) => setTimeout(r, 50));
        return makeFetchResponse({ phase: "idle", message: "" });
      }
      return makeFetchResponse({}, 404);
    });

    const refreshAsrRuntimeInfo = vi.fn(async () => {});
    const getSelectedHubModelId = () => SELECTED_HUB;

    const { result } = renderHook(() =>
      usePrepareModelController(refreshAsrRuntimeInfo, getSelectedHubModelId),
    );

    await act(async () => {
      const promise = result.current.prepareDefaultFunasrModel();
      // Abort quickly so the idle loop does not run forever.
      setTimeout(() => {
        result.current.cancelPrepareModel().catch(() => {});
      }, 200);
      await promise.catch(() => {});
    });

    // We expect exactly one /health call from the precheck, and zero additional
    // /health calls from the idle-after-4s branch.
    expect(healthCallCount).toBe(1);
  });
});
