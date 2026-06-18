import { describe, expect, it } from "vitest";
import { LIST_RAPID_SELECT_MS, nextListSelectSource, segmentListScrollCoalesceMs } from "./segmentListSelectSource";
import { LIST_ADVANCE_PLAY_COALESCE_MS } from "./scheduleListAdvanceSegmentPlayback";

describe("segmentListScrollCoalesceMs", () => {
  it("scrolls immediately for list click and waveform select", () => {
    expect(segmentListScrollCoalesceMs("list")).toBe(0);
    expect(segmentListScrollCoalesceMs("waveform")).toBe(0);
  });

  it("coalesces scroll for keyboard and rapid list advance", () => {
    expect(segmentListScrollCoalesceMs("listKeyboard")).toBe(LIST_ADVANCE_PLAY_COALESCE_MS);
    expect(segmentListScrollCoalesceMs("listAdvance")).toBe(LIST_ADVANCE_PLAY_COALESCE_MS);
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
