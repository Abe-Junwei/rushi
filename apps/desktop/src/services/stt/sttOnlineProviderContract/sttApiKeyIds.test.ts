import { describe, expect, it } from "vitest";
import {
  DEFAULT_STT_API_KEY_ID,
  IFLYTEK_STT_API_KEY_ID,
  IFLYTEK_STT_API_SECRET_ID,
  isCorruptSttApiKeyId,
  isStaleSttApiKeyIdForProvider,
  normalizeSttApiKeyId,
  resolveSttApiKeyIdForProvider,
  resolveSttApiSecretIdForProvider,
} from "./sttApiKeyIds";

describe("normalizeSttApiKeyId", () => {
  it("returns undefined for empty input", () => {
    expect(normalizeSttApiKeyId("")).toBeUndefined();
    expect(normalizeSttApiKeyId(null)).toBeUndefined();
  });

  it("sanitizes corrupt apiKeyId that looks like an API key", () => {
    expect(normalizeSttApiKeyId("sk-3dad49106a1b4065b472b6894bf0ab36")).toBe(DEFAULT_STT_API_KEY_ID);
    expect(isCorruptSttApiKeyId("sk-test")).toBe(true);
  });

  it("preserves valid account ids", () => {
    expect(normalizeSttApiKeyId("work")).toBe("work");
    expect(normalizeSttApiKeyId("default")).toBe("default");
  });
});

describe("resolveSttApiKeyIdForProvider", () => {
  it("uses dedicated slot for iflytek-speed-asr", () => {
    expect(resolveSttApiKeyIdForProvider("iflytek-speed-asr")).toBe(IFLYTEK_STT_API_KEY_ID);
    expect(resolveSttApiSecretIdForProvider("iflytek-speed-asr")).toBe(IFLYTEK_STT_API_SECRET_ID);
    expect(resolveSttApiKeyIdForProvider("dashscope-asr")).toBe(DEFAULT_STT_API_KEY_ID);
    expect(resolveSttApiSecretIdForProvider("dashscope-asr")).toBeUndefined();
  });
});

describe("isStaleSttApiKeyIdForProvider", () => {
  it("flags cross-provider apiKeyId reuse", () => {
    expect(isStaleSttApiKeyIdForProvider("iflytek-speed-asr", DEFAULT_STT_API_KEY_ID)).toBe(true);
    expect(isStaleSttApiKeyIdForProvider("dashscope-asr", IFLYTEK_STT_API_KEY_ID)).toBe(true);
    expect(isStaleSttApiKeyIdForProvider("iflytek-speed-asr", IFLYTEK_STT_API_KEY_ID)).toBe(false);
  });
});
