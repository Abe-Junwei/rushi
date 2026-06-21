import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../config/env", () => ({
  isTauriRuntime: vi.fn(() => true),
}));

vi.mock("../services/asr/asrModelUnload", () => ({
  postAsrModelUnload: vi.fn(async () => ({ status: "ok", funasr_loaded_model_id: null, funasr_model_id: "m" })),
}));

import { isTauriRuntime } from "../config/env";
import { postAsrModelUnload } from "../services/asr/asrModelUnload";
import {
  ASR_MODEL_UNLOAD_IDLE_DELAY_MS,
  useAsrModelUnloadOnFileSwitch,
} from "./useAsrModelUnloadOnFileSwitch";

describe("useAsrModelUnloadOnFileSwitch", () => {
  const refreshAsrHealth = vi.fn(async () => {});

  const baseProps = {
    busy: false,
    batchTranscribeRunning: false,
    prepareModelBusy: false,
    prepareModelCancelling: false,
    refreshAsrHealth,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(postAsrModelUnload).mockClear();
    refreshAsrHealth.mockClear();
    vi.mocked(isTauriRuntime).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not unload on first mount", () => {
    renderHook(() =>
      useAsrModelUnloadOnFileSwitch({
        currentFileId: "file-a",
        ...baseProps,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(ASR_MODEL_UNLOAD_IDLE_DELAY_MS);
    });
    expect(postAsrModelUnload).not.toHaveBeenCalled();
  });

  it("unloads after idle delay when currentFileId changes", async () => {
    const { rerender } = renderHook(
      (props) => useAsrModelUnloadOnFileSwitch(props),
      {
        initialProps: {
          currentFileId: "file-a" as string | null,
          ...baseProps,
        },
      },
    );
    rerender({
      currentFileId: "file-b",
      ...baseProps,
    });
    act(() => {
      vi.advanceTimersByTime(ASR_MODEL_UNLOAD_IDLE_DELAY_MS - 1);
    });
    expect(postAsrModelUnload).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(postAsrModelUnload).toHaveBeenCalledTimes(1);
    expect(refreshAsrHealth).toHaveBeenCalledTimes(1);
  });

  it("cancels pending unload when file switches again before delay", async () => {
    const { rerender } = renderHook(
      (props) => useAsrModelUnloadOnFileSwitch(props),
      {
        initialProps: {
          currentFileId: "file-a" as string | null,
          ...baseProps,
        },
      },
    );
    rerender({ currentFileId: "file-b", ...baseProps });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ currentFileId: "file-c", ...baseProps });
    act(() => {
      vi.advanceTimersByTime(ASR_MODEL_UNLOAD_IDLE_DELAY_MS);
    });
    expect(postAsrModelUnload).toHaveBeenCalledTimes(1);
  });

  it("skips unload while busy", async () => {
    const { rerender } = renderHook(
      (props) => useAsrModelUnloadOnFileSwitch(props),
      {
        initialProps: {
          currentFileId: "file-a" as string | null,
          ...baseProps,
        },
      },
    );
    rerender({
      currentFileId: "file-b",
      ...baseProps,
      busy: true,
    });
    act(() => {
      vi.advanceTimersByTime(ASR_MODEL_UNLOAD_IDLE_DELAY_MS);
    });
    expect(postAsrModelUnload).not.toHaveBeenCalled();
  });

  it("skips unload while batch transcribe is running", async () => {
    const { rerender } = renderHook(
      (props) => useAsrModelUnloadOnFileSwitch(props),
      {
        initialProps: {
          currentFileId: "file-a" as string | null,
          ...baseProps,
        },
      },
    );
    rerender({
      currentFileId: "file-b",
      ...baseProps,
      batchTranscribeRunning: true,
    });
    act(() => {
      vi.advanceTimersByTime(ASR_MODEL_UNLOAD_IDLE_DELAY_MS);
    });
    expect(postAsrModelUnload).not.toHaveBeenCalled();
  });

  it("aborts pending unload if busy becomes true during delay", async () => {
    const { rerender } = renderHook(
      (props) => useAsrModelUnloadOnFileSwitch(props),
      {
        initialProps: {
          currentFileId: "file-a" as string | null,
          ...baseProps,
        },
      },
    );
    rerender({ currentFileId: "file-b", ...baseProps });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ currentFileId: "file-b", ...baseProps, busy: true });
    act(() => {
      vi.advanceTimersByTime(ASR_MODEL_UNLOAD_IDLE_DELAY_MS);
    });
    expect(postAsrModelUnload).not.toHaveBeenCalled();
  });

  it("skips unload outside Tauri runtime", async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(false);
    const { rerender } = renderHook(
      (props) => useAsrModelUnloadOnFileSwitch(props),
      {
        initialProps: {
          currentFileId: "file-a" as string | null,
          ...baseProps,
        },
      },
    );
    rerender({
      currentFileId: "file-b",
      ...baseProps,
    });
    act(() => {
      vi.advanceTimersByTime(ASR_MODEL_UNLOAD_IDLE_DELAY_MS);
    });
    expect(postAsrModelUnload).not.toHaveBeenCalled();
  });
});
