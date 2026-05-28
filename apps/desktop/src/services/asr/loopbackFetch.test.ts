import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../config/env", () => ({
  asrBaseUrl: () => "http://localhost:8741",
  isTauriRuntime: () => true,
}));

describe("defaultLoopbackTimeoutMs", () => {
  it("uses short timeout for health", async () => {
    const { defaultLoopbackTimeoutMs } = await import("./loopbackFetch");
    expect(defaultLoopbackTimeoutMs("GET", "/health")).toBe(8000);
    expect(defaultLoopbackTimeoutMs("POST", "/v1/models/prepare/async")).toBe(900_000);
  });
});

describe("loopbackFetch", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("proxies GET /health through Tauri invoke", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue({
      status: 200,
      body: { status: "ok", service: "rushi-asr" },
    });
    const { loopbackFetch } = await import("./loopbackFetch");
    const res = await loopbackFetch("http://localhost:8741/health");
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.service).toBe("rushi-asr");
    expect(invoke).toHaveBeenCalledWith("asr_loopback_request", {
      path: "/health",
      method: "GET",
      body: null,
      port: 8741,
      timeoutMs: 8000,
    });
  });
});
