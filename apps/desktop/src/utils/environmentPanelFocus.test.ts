import { describe, expect, it } from "vitest";
import { resolveEnvironmentFocusSection } from "./environmentPanelFocus";

describe("resolveEnvironmentFocusSection", () => {
  it("prefers local-asr when stale llm focus seq is still set", () => {
    expect(
      resolveEnvironmentFocusSection({
        focusLocalAsrSeq: 2,
        focusOnlineSttSeq: 0,
        focusLlmSeq: 5,
      }),
    ).toBe("local-asr");
  });

  it("opens llm only when asr and online stt are cleared", () => {
    expect(
      resolveEnvironmentFocusSection({
        focusLocalAsrSeq: 0,
        focusOnlineSttSeq: 0,
        focusLlmSeq: 1,
      }),
    ).toBe("llm");
  });

  it("returns null when no focus requested", () => {
    expect(
      resolveEnvironmentFocusSection({
        focusLocalAsrSeq: 0,
        focusOnlineSttSeq: 0,
        focusLlmSeq: 0,
      }),
    ).toBeNull();
  });
});
