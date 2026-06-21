import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./loopbackFetch", () => ({
  loopbackFetch: vi.fn(),
}));

import { loopbackFetch } from "./loopbackFetch";
import { postAsrModelUnload } from "./asrModelUnload";

describe("postAsrModelUnload", () => {
  beforeEach(() => {
    vi.mocked(loopbackFetch).mockReset();
  });

  it("returns parsed body on 200", async () => {
    vi.mocked(loopbackFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          funasr_loaded_model_id: null,
          funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        }),
        { status: 200 },
      ),
    );
    const result = await postAsrModelUnload();
    expect(result?.status).toBe("ok");
    expect(result?.funasr_loaded_model_id).toBeNull();
    expect(loopbackFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/models/unload"),
      expect.objectContaining({ method: "POST", loopbackTimeoutMs: 8_000 }),
    );
  });

  it("returns null on non-OK without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(loopbackFetch).mockResolvedValue(new Response("{}", { status: 409 }));
    await expect(postAsrModelUnload()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null on fetch error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(loopbackFetch).mockRejectedValue(new Error("network"));
    await expect(postAsrModelUnload()).resolves.toBeNull();
    warn.mockRestore();
  });
});
