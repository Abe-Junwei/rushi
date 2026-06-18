import { describe, expect, it } from "vitest";
import { LIST_RAPID_SELECT_MS, nextListSelectSource, segmentListScrollCoalesceMs } from "./segmentListSelectSource";

describe("segmentListScrollCoalesceMs", () => {
  it("scrolls immediately for all segment select sources", () => {
    expect(segmentListScrollCoalesceMs("list")).toBe(0);
    expect(segmentListScrollCoalesceMs("listAdvance")).toBe(0);
    expect(segmentListScrollCoalesceMs("listKeyboard")).toBe(0);
    expect(segmentListScrollCoalesceMs("waveform")).toBe(0);
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
