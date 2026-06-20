import { describe, expect, it } from "vitest";
import { buildOnlineSttEnvPresentation } from "./onlineSttEnvStatus";

const baseInput = {
  enabled: true,
  providerId: "openai",
  endpoint: "",
  appKey: "",
  hasTypedApiKey: false,
  keychainReady: null as boolean | null,
  connectionVerified: false,
  lastProbeAvailable: null as boolean | null,
  lastProbeMessage: null as string | null,
};

describe("buildOnlineSttEnvPresentation", () => {
  it("shows idle when disabled", () => {
    const p = buildOnlineSttEnvPresentation({
      ...baseInput,
      enabled: false,
      hasApiKeyReference: false,
    });
    expect(p.tone).toBe("idle");
    expect(p.bannerTitle).toContain("未启用");
  });

  it("does not show ok when key reference and verified fingerprint exist but keychain is missing", () => {
    const p = buildOnlineSttEnvPresentation({
      ...baseInput,
      hasApiKeyReference: true,
      connectionVerified: true,
      keychainReady: false,
      lastProbeAvailable: true,
      lastProbeMessage: "可达（约 120 ms）",
    });
    expect(p.tone).toBe("error");
    expect(p.chipOk).toBe(false);
    expect(p.bannerTitle).toContain("密钥异常");
  });

  it("shows ok when verified with saved key reference and keychain present", () => {
    const p = buildOnlineSttEnvPresentation({
      ...baseInput,
      hasApiKeyReference: true,
      connectionVerified: true,
      keychainReady: true,
      lastProbeAvailable: true,
      lastProbeMessage: "可达（约 120 ms）",
    });
    expect(p.tone).toBe("ok");
    expect(p.chipOk).toBe(true);
    expect(p.bannerDetail).toContain("120 ms");
  });

  it("warns while keychain check is pending despite verified fingerprint", () => {
    const p = buildOnlineSttEnvPresentation({
      ...baseInput,
      hasApiKeyReference: true,
      connectionVerified: true,
      keychainReady: null,
    });
    expect(p.tone).toBe("warn");
    expect(p.chipOk).toBe(false);
  });

  it("warns when verified but key reference missing", () => {
    const p = buildOnlineSttEnvPresentation({
      ...baseInput,
      hasApiKeyReference: false,
      connectionVerified: true,
    });
    expect(p.tone).toBe("warn");
    expect(p.bannerTitle).toContain("待填写凭证");
    expect(p.chipOk).toBe(false);
  });

  it("warns when gateway endpoint missing", () => {
    const p = buildOnlineSttEnvPresentation({
      ...baseInput,
      providerId: "custom-proxy",
      hasApiKeyReference: true,
      hasTypedApiKey: true,
    });
    expect(p.tone).toBe("warn");
    expect(p.bannerDetail).toContain("转写 URL");
  });
});
