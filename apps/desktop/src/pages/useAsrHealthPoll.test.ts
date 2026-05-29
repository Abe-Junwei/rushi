import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAsrHealthPoll } from "./useAsrHealthPoll";

vi.mock("../services/asr/loopbackFetch", () => ({
  loopbackFetch: vi.fn(),
}));

import { loopbackFetch } from "../services/asr/loopbackFetch";

const healthPayload = {
  status: "ok",
  service: "rushi-asr",
  ffmpeg_ok: true,
  funasr_import_ok: true,
  funasr_model_configured: true,
  funasr_ready: true,
  ready_for_transcribe: true,
  transcription_mode: "funasr",
  funasr_model_id: "iic/SenseVoiceSmall",
  local_asr_model_catalog: [],
};

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
});
