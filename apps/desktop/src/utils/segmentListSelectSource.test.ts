import { describe, expect, it } from "vitest";
import { LIST_RAPID_SELECT_MS, isListSegmentSelectSource, nextListSelectSource } from "./segmentListSelectSource";

describe("isListSegmentSelectSource", () => {
  it("matches list navigation sources only", () => {
    expect(isListSegmentSelectSource("list")).toBe(true);
    expect(isListSegmentSelectSource("listAdvance")).toBe(true);
    expect(isListSegmentSelectSource("listKeyboard")).toBe(true);
    expect(isListSegmentSelectSource("waveform")).toBe(false);
  });
});

describe("nextListSelectSource", () => {
  it("first click uses list (zoom)", () => {
    const state = { lastAtMs: 0 };
    expect(nextListSelectSource(1000, state)).toBe("list");
  });

  it("rapid follow-up uses listAdvance", () => {
    const state = { lastAtMs: 0 };
    nextListSelectSource(1000, state);
    expect(nextListSelectSource(1000 + LIST_RAPID_SELECT_MS - 1, state)).toBe("listAdvance");
  });

  it("after cooldown returns to list", () => {
    const state = { lastAtMs: 0 };
    nextListSelectSource(1000, state);
    expect(nextListSelectSource(1000 + LIST_RAPID_SELECT_MS, state)).toBe("list");
  });
});
