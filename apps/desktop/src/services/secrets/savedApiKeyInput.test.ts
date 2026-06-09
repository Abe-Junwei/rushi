import { describe, expect, it } from "vitest";
import {
  normalizeSavedApiKeyInputChange,
  resolveSavedApiKeyInputDisplay,
  SAVED_API_KEY_MASK,
} from "./savedApiKeyInput";

describe("savedApiKeyInput", () => {
  it("shows mask when saved key exists and field is empty", () => {
    expect(
      resolveSavedApiKeyInputDisplay({
        typedApiKey: "",
        savedApiKeyId: "default",
        keychainReady: true,
      }),
    ).toBe(SAVED_API_KEY_MASK);
  });

  it("prefers typed draft over mask", () => {
    expect(
      resolveSavedApiKeyInputDisplay({
        typedApiKey: "sk-new",
        savedApiKeyId: "default",
        keychainReady: true,
      }),
    ).toBe("sk-new");
  });

  it("hides mask when keychain reports missing secret", () => {
    expect(
      resolveSavedApiKeyInputDisplay({
        typedApiKey: "",
        savedApiKeyId: "default",
        keychainReady: false,
      }),
    ).toBe("");
  });

  it("normalizeSavedApiKeyInputChange strips mask bullets when editing from mask", () => {
    expect(normalizeSavedApiKeyInputChange("sk-live", true)).toBe("sk-live");
    expect(normalizeSavedApiKeyInputChange("••sk", true)).toBe("sk");
    expect(normalizeSavedApiKeyInputChange("", true)).toBe("");
  });
});
