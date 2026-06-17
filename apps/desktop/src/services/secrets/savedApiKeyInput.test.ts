import { describe, expect, it } from "vitest";
import {
  normalizeSavedApiKeyInputChange,
  resolveSavedApiKeyInputDisplay,
  shouldClearSavedKeyFromMaskInput,
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

  it("hides mask while keychain status is unknown", () => {
    expect(
      resolveSavedApiKeyInputDisplay({
        typedApiKey: "",
        savedApiKeyId: "default",
        keychainReady: null,
      }),
    ).toBe("");
  });

  it("normalizeSavedApiKeyInputChange strips mask bullets when editing from mask", () => {
    expect(normalizeSavedApiKeyInputChange("sk-live", true)).toBe("sk-live");
    expect(normalizeSavedApiKeyInputChange("••sk", true)).toBe("sk");
    expect(normalizeSavedApiKeyInputChange("", true)).toBe("");
  });

  it("detects clearing saved key from mask input", () => {
    expect(shouldClearSavedKeyFromMaskInput(true, "")).toBe(true);
    expect(shouldClearSavedKeyFromMaskInput(false, "")).toBe(false);
    expect(shouldClearSavedKeyFromMaskInput(true, "sk-new")).toBe(false);
  });
});
