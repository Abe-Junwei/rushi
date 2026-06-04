import { describe, expect, it } from "vitest";
import { buildOnlineSttEnvPresentation } from "./onlineSttEnvStatus";

describe("buildOnlineSttEnvPresentation", () => {
  it("shows idle when disabled", () => {
    const p = buildOnlineSttEnvPresentation({
      enabled: false,
      providerId: "openai",
      endpoint: "",
      appKey: "",
      hasApiKeyInSession: false,
      connectionVerified: false,
      lastProbeAvailable: null,
      lastProbeMessage: null,
    });
    expect(p.tone).toBe("idle");
    expect(p.bannerTitle).toContain("未启用");
  });

  it("shows ok when verified with session key", () => {
    const p = buildOnlineSttEnvPresentation({
      enabled: true,
      providerId: "openai",
      endpoint: "",
      appKey: "",
      hasApiKeyInSession: true,
      connectionVerified: true,
      lastProbeAvailable: true,
      lastProbeMessage: "可达（约 120 ms）",
    });
    expect(p.tone).toBe("ok");
    expect(p.chipOk).toBe(true);
    expect(p.bannerDetail).toContain("120 ms");
  });

  it("warns when verified but session key missing", () => {
    const p = buildOnlineSttEnvPresentation({
      enabled: true,
      providerId: "openai",
      endpoint: "",
      appKey: "",
      hasApiKeyInSession: false,
      connectionVerified: true,
      lastProbeAvailable: null,
      lastProbeMessage: null,
    });
    expect(p.tone).toBe("warn");
    expect(p.bannerTitle).toContain("待填写凭证");
    expect(p.chipOk).toBe(false);
  });

  it("warns when gateway endpoint missing", () => {
    const p = buildOnlineSttEnvPresentation({
      enabled: true,
      providerId: "custom-proxy",
      endpoint: "",
      appKey: "",
      hasApiKeyInSession: true,
      connectionVerified: false,
      lastProbeAvailable: null,
      lastProbeMessage: null,
    });
    expect(p.tone).toBe("warn");
    expect(p.bannerDetail).toContain("转写 URL");
  });
});
