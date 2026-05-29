import { describe, expect, it } from "vitest";
import {
  isAllowedSttOnlineEndpoint,
  normalizeExternalSttOnlineRuntimeConfig,
  resolveSttOnlineProbeUrl,
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
  it("falls back unknown provider id to openai", () => {
    const c = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "unknown-vendor",
      timeoutMs: 5000,
    });
    expect(c.selectedProviderId).toBe("openai");
  });

  it("keeps appKey when provided", () => {
    const c = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "aliyun-nls",
      appKey: "  my-app-key ",
      timeoutMs: 5000,
    });
    expect(c.appKey).toBe("my-app-key");
  });
});

describe("sttOnlineProvidersByMarket", () => {
  it("includes aliyun under china", () => {
    const ids = sttOnlineProvidersByMarket("china").map((d) => d.id);
    expect(ids).toContain("aliyun-nls");
    expect(ids).toContain("tencent-asr");
  });

  it("lists free-tier-noted providers before others within each market", () => {
    const china = sttOnlineProvidersByMarket("china").map((d) => d.id);
    expect(china.indexOf("aispeech")).toBe(china.length - 1);

    const globalIds = sttOnlineProvidersByMarket("global").map((d) => d.id);
    expect(globalIds[globalIds.length - 1]).toBe("custom-proxy");
  });
});

describe("resolveSttOnlineProbeUrl", () => {
  it("uses explicit endpoint when valid", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "deepgram",
          endpoint: "https://api.deepgram.com",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://api.deepgram.com");
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
});
