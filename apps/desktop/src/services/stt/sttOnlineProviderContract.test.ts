import { describe, expect, it } from "vitest";
import {
  clampSttOnlineTimeoutSec,
  defaultTimeoutMsForProvider,
  isAllowedSttOnlineEndpoint,
  normalizeExternalSttOnlineRuntimeConfig,
  probeExternalSttOnlineHealth,
  resolveSttOnlineProbeUrl,
  setSttOnlineApiKeyInMemory,
  sttOnlineProviderEndpointUserConfigurable,
  sttOnlineProvidersByMarket,
} from "./sttOnlineProviderContract";

describe("isAllowedSttOnlineEndpoint", () => {
  it("allows https", () => {
    expect(isAllowedSttOnlineEndpoint("https://api.openai.com/v1")).toBe(true);
  });

  it("allows http on loopback only", () => {
    expect(isAllowedSttOnlineEndpoint("http://127.0.0.1:8741")).toBe(true);
    expect(isAllowedSttOnlineEndpoint("http://localhost:3000")).toBe(true);
    expect(isAllowedSttOnlineEndpoint("http://example.com")).toBe(false);
    expect(isAllowedSttOnlineEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedSttOnlineEndpoint("https://10.0.0.5/v1")).toBe(false);
  });
});

describe("normalizeExternalSttOnlineRuntimeConfig", () => {
  it("migrates removed short-window provider ids to dashscope-asr", () => {
    const c = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "aliyun-nls",
      timeoutMs: 5000,
    });
    expect(c.selectedProviderId).toBe("dashscope-asr");
  });

  it("falls back unknown provider id to openai", () => {
    const c = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "unknown-vendor",
      timeoutMs: 5000,
    });
    expect(c.selectedProviderId).toBe("openai");
  });

  it("uses provider default timeout when partial omits timeoutMs", () => {
    const c = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "assemblyai",
    });
    expect(c.timeoutMs).toBe(defaultTimeoutMsForProvider("assemblyai"));
    expect(c.timeoutMs).toBe(600_000);
  });
});

describe("clampSttOnlineTimeoutSec", () => {
  it("clamps to 30–600 seconds", () => {
    expect(clampSttOnlineTimeoutSec(0)).toBe(30);
    expect(clampSttOnlineTimeoutSec(NaN)).toBe(30);
    expect(clampSttOnlineTimeoutSec(120)).toBe(120);
    expect(clampSttOnlineTimeoutSec(999)).toBe(600);
  });
});

describe("sttOnlineProvidersByMarket", () => {
  it("includes only dashscope-asr under china", () => {
    const ids = sttOnlineProvidersByMarket("china").map((d) => d.id);
    expect(ids).toEqual(["dashscope-asr"]);
  });

  it("lists free-tier-noted providers before others within each market", () => {
    const china = sttOnlineProvidersByMarket("china").map((d) => d.id);
    expect(china).toEqual(["dashscope-asr"]);

    const globalIds = sttOnlineProvidersByMarket("global").map((d) => d.id);
    expect(globalIds[globalIds.length - 1]).toBe("custom-proxy");
  });
});

describe("resolveSttOnlineProbeUrl", () => {
  it("uses explicit endpoint when valid for custom proxy", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "custom-proxy",
          endpoint: "https://proxy.example.com/v1/transcribe",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://proxy.example.com/v1/transcribe");
  });

  it("returns default OpenAI probe when endpoint empty", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "openai",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://api.openai.com/v1/models");
  });

  it("returns deepgram projects probe when endpoint empty", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "deepgram",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://api.deepgram.com/v1/projects");
  });

  it("returns assemblyai transcript list probe when endpoint empty", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "assemblyai",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://api.assemblyai.com/v2/transcript");
  });

  it("only custom-proxy requires user endpoint", () => {
    expect(sttOnlineProviderEndpointUserConfigurable("dashscope-asr")).toBe(false);
    expect(sttOnlineProviderEndpointUserConfigurable("custom-proxy")).toBe(true);
  });

  it("returns dashscope probe when endpoint empty", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "dashscope-asr",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1/models");
  });

  it("requires fetchImpl for deepgram HTTP probe in non-tauri test", async () => {
    setSttOnlineApiKeyInMemory("dg-key");
    const r = await probeExternalSttOnlineHealth({
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
        }) as Response,
      runtimeConfig: normalizeExternalSttOnlineRuntimeConfig({
        enabled: true,
        selectedProviderId: "deepgram",
        timeoutMs: 5000,
      }),
    });
    expect(r.available).toBe(true);
    expect(r.endpoint).toBe("https://api.deepgram.com/v1/projects");
    setSttOnlineApiKeyInMemory(null);
  });
});
