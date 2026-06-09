import { describe, expect, it } from "vitest";
import {
  DEFAULT_STT_API_KEY_ID,
  isCorruptSttApiKeyId,
  normalizeSttApiKeyId,
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
