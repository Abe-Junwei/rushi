import { describe, expect, it } from "vitest";
import { segmentTextAreaLayoutVars } from "./useSegmentRowTextStyle";

describe("segmentTextAreaLayoutVars", () => {
  const textStyle = {
    fontSize: 14,
    lineHeight: 1.72,
    letterSpacing: "0.005em",
    fontWeight: 500 as const,
    fontStyle: "normal" as const,
    fontFamily: "Inter, sans-serif",
  };

  it("maps transcript typography to seg-text CSS vars for mirror/textarea parity", () => {
    expect(segmentTextAreaLayoutVars(textStyle, 48, false)).toEqual({
      "--seg-text-font-size": "14px",
      "--seg-text-line-height": "1.72",
      "--seg-text-letter-spacing": "0.005em",
      "--seg-text-font-weight": 500,
      "--seg-text-font-style": "normal",
      "--seg-text-font-family": "Inter, sans-serif",
      "--seg-text-min-height": "48px",
      "--seg-text-max-height": "48px",
    });
  });
});
