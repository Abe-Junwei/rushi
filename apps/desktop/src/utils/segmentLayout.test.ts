import { describe, expect, it } from "vitest";
import {
  TRANSCRIPT_FONT_DRAG_PX_PER_STEP,
  transcriptFontPxFromDragDelta,
} from "./segmentLayout";
import { TRANSCRIPT_FONT_DEFAULT } from "./waveformPrefs";

describe("transcriptFontPxFromDragDelta", () => {
  it("uses 8px per 1px font step by default", () => {
    expect(TRANSCRIPT_FONT_DRAG_PX_PER_STEP).toBe(8);
    expect(transcriptFontPxFromDragDelta(TRANSCRIPT_FONT_DEFAULT, 0)).toBe(
      TRANSCRIPT_FONT_DEFAULT,
    );
    expect(transcriptFontPxFromDragDelta(TRANSCRIPT_FONT_DEFAULT, 7)).toBe(
      TRANSCRIPT_FONT_DEFAULT,
    );
    expect(transcriptFontPxFromDragDelta(TRANSCRIPT_FONT_DEFAULT, 8)).toBe(
      TRANSCRIPT_FONT_DEFAULT + 1,
    );
    expect(transcriptFontPxFromDragDelta(TRANSCRIPT_FONT_DEFAULT, 30)).toBe(
      TRANSCRIPT_FONT_DEFAULT + 3,
    );
    expect(transcriptFontPxFromDragDelta(TRANSCRIPT_FONT_DEFAULT, -16)).toBe(
      TRANSCRIPT_FONT_DEFAULT - 2,
    );
  });
});
