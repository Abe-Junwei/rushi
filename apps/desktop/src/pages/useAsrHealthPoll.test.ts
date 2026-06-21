import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  shouldSkipAsrHealthDowngrade,
  useAsrHealthPoll,
  type AsrHealthRefreshResult,
} from "./useAsrHealthPoll";

vi.mock("../services/asr/loopbackFetch", () => ({
  loopbackFetch: vi.fn(),
}));

vi.mock("../tauri/projectApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tauri/projectApi")>();
  return {
    ...actual,
    bundledAsrLaunchReport: vi.fn().mockRejectedValue(new Error("no tauri")),
  };
});

import { loopbackFetch } from "../services/asr/loopbackFetch";
import { MIN_VISIBLE_BUSY_MS } from "../services/ui/minVisibleBusy";
import type { AsrHealthCapabilities } from "../tauri/projectApi";

const mockOkCaps: AsrHealthCapabilities = {
  ffmpeg_ok: true,
  funasr_import_ok: true,
  funasr_model_configured: true,
  funasr_ready: true,
  ready_for_transcribe: true,
  transcription_mode: "funasr",
  funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
};

const healthPayload = {
  status: "ok",
  service: "rushi-asr",
  ffmpeg_ok: true,
  funasr_import_ok: true,
  funasr_model_configured: true,
  funasr_ready: true,
  ready_for_transcribe: true,
  transcription_mode: "funasr",
  funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
  local_asr_model_catalog: [],
};

describe("shouldSkipAsrHealthDowngrade", () => {
  const lastGood: AsrHealthRefreshResult = {
    health: "ok",
    healthDetail: "",
    caps: mockOkCaps,
    healthJson: null,
    rootJson: null,
  };

  it("skips background downgrade when last good snapshot exists", () => {
    expect(shouldSkipAsrHealthDowngrade(false, { health: "error" }, lastGood)).toBe(true);
  });

  it("allows foreground downgrade and successful refresh", () => {
    expect(shouldSkipAsrHealthDowngrade(true, { health: "error" }, lastGood)).toBe(false);
    expect(shouldSkipAsrHealthDowngrade(false, { health: "ok" }, lastGood)).toBe(false);
  });

  it("preserves snapshot during model download even on foreground poll", () => {
    expect(
      shouldSkipAsrHealthDowngrade(true, { health: "error" }, lastGood, {
        preserveDuringModelPrepare: true,
      }),
    ).toBe(true);
  });

  it("preserves snapshot during offline import even on foreground poll", () => {
    expect(
      shouldSkipAsrHealthDowngrade(true, { health: "error" }, lastGood, {
        preserveDuringOfflineImport: true,
      }),
    ).toBe(true);
  });
});

describe("useAsrHealthPoll", () => {
  it("dedupes concurrent refresh calls", async () => {
    const catalogHooksRef = {
      current: {
        syncFromHealth: vi.fn(),
        refreshIfNeeded: vi.fn(),
      },
    };
    let resolveHealth: (v: Response) => void = () => {};
    const healthPromise = new Promise<Response>((resolve) => {
      resolveHealth = resolve;
    });
    vi.mocked(loopbackFetch).mockImplementation(async (url) => {
      if (String(url).endsWith("/health")) {
        return healthPromise;
      }
      return new Response(JSON.stringify({ service: "rushi-asr" }), { status: 200 });
    });

    const { result } = renderHook(() =>
      useAsrHealthPoll({ tauriRuntime: true, catalogHooksRef }),
    );

    const p1 = result.current.refreshAsrHealth({ touchUi: false });
    const p2 = result.current.refreshAsrHealth({ touchUi: false });
    expect(loopbackFetch).toHaveBeenCalledTimes(1);

    resolveHealth(
      new Response(JSON.stringify(healthPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await act(async () => {
      await Promise.all([p1, p2]);
    });
  });

  it("keeps checking visible for minimum duration when health fails instantly", async () => {
    vi.useFakeTimers();
    const catalogHooksRef = {
      current: {
        syncFromHealth: vi.fn(),
        refreshIfNeeded: vi.fn(),
      },
    };
    vi.mocked(loopbackFetch).mockRejectedValue(new Error("connection refused"));

    const { result } = renderHook(() =>
      useAsrHealthPoll({ tauriRuntime: true, catalogHooksRef }),
    );

    await act(async () => {
      const refresh = result.current.refreshAsrHealth({ touchUi: true });
      await Promise.resolve();
      expect(result.current.asrHealth).toBe("checking");
      await vi.advanceTimersByTimeAsync(MIN_VISIBLE_BUSY_MS - 1);
      expect(result.current.asrHealth).toBe("checking");
      await vi.advanceTimersByTimeAsync(1);
      await refresh;
    });

    expect(result.current.asrHealth).toBe("error");
    vi.useRealTimers();
  });

  it("preserves last good state when background refresh fails", async () => {
    const catalogHooksRef = {
      current: {
        syncFromHealth: vi.fn(),
        refreshIfNeeded: vi.fn(),
      },
    };
    vi.mocked(loopbackFetch).mockImplementation((url) => {
      if (String(url).endsWith("/health")) {
        return Promise.resolve(
          new Response(JSON.stringify(healthPayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ service: "rushi-asr" }), { status: 200 }));
    });

    const { result } = renderHook(() =>
      useAsrHealthPoll({ tauriRuntime: true, catalogHooksRef }),
    );

    await act(async () => {
      await result.current.refreshAsrHealth({ touchUi: false });
    });
    expect(result.current.asrHealth).toBe("ok");
    expect(result.current.asrCaps?.ffmpeg_ok).toBe(true);

    vi.mocked(loopbackFetch).mockRejectedValue(new Error("timeout"));
    await act(async () => {
      await result.current.refreshAsrHealth({ touchUi: false });
    });

    expect(result.current.asrHealth).toBe("ok");
    expect(result.current.asrCaps?.ffmpeg_ok).toBe(true);
  });
});
