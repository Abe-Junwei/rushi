// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import {
  resetSelectionChromeStoreForTests,
  selectionRowState,
  SELECTION_ROW_STATE,
} from "./selectionChromeStore";
import { publishSelectionChromeForIndices } from "./publishSelectionChromeForInput";

describe("segment list range drag chrome", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("publishes in-selection chrome for every row in a drag range", () => {
    const ctx = {
      fileId: "f1",
      segments: Array.from({ length: 8 }, (_, idx) => ({
        uid: `s-${idx}`,
        idx,
        start_sec: idx,
        end_sec: idx + 1,
        text: "",
      })),
    } as unknown as TranscriptionLayerInput;

    publishSelectionChromeForIndices(ctx, [2, 3, 4, 5], 5, {
      listRoot: null,
      overlayRoot: null,
    });

    expect(selectionRowState(2).inSelection).toBe(true);
    expect(selectionRowState(3).inSelection).toBe(true);
    expect(selectionRowState(4).inSelection).toBe(true);
    expect(selectionRowState(5)).toEqual(SELECTION_ROW_STATE.primary);
    expect(selectionRowState(1)).toEqual(SELECTION_ROW_STATE.none);
  });
});
