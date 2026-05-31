import { describe, expect, it } from "vitest";
import {
  normalizeLocalAsrRecognitionLanguage,
  sidecarRecognitionLanguageMatchesSelection,
} from "./localAsrRecognitionLanguage";

describe("localAsrRecognitionLanguage", () => {
  it("normalize defaults invalid to zh", () => {
    expect(normalizeLocalAsrRecognitionLanguage(null)).toBe("zh");
    expect(normalizeLocalAsrRecognitionLanguage("auto")).toBe("auto");
    expect(normalizeLocalAsrRecognitionLanguage("fr")).toBe("zh");
  });

  it("matches sidecar language from health", () => {
    expect(sidecarRecognitionLanguageMatchesSelection("zh", "zh")).toBe(true);
    expect(sidecarRecognitionLanguageMatchesSelection("auto", "zh")).toBe(false);
    expect(sidecarRecognitionLanguageMatchesSelection("auto", "auto")).toBe(true);
    expect(sidecarRecognitionLanguageMatchesSelection(undefined, "zh")).toBe(false);
    expect(sidecarRecognitionLanguageMatchesSelection(null, "zh")).toBe(false);
  });
});
