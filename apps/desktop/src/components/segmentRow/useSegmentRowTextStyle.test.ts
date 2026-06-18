import { describe, expect, it } from "vitest";
import { segmentTextAreaLayoutVars } from "./useSegmentRowTextStyle";

describe("segmentTextAreaLayoutVars", () => {
  const textStyle = {
    fontSize: 14,
    lineHeight: 1.72,
    letterSpacing: "0.005em",
    fontWeight: 500 as const,
    fontStyle: "normal" as const,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  };

  it("maps typography to CSS custom properties with fallbacks in workspace.css", () => {
    const vars = segmentTextAreaLayoutVars(textStyle, 48, false);
    expect(vars["--seg-text-font-size"]).toBe("14px");
    expect(vars["--seg-text-min-height"]).toBe("48px");
    expect(vars["--seg-text-max-height"]).toBe("48px");
  });

  it("omits max-height cap when row is selected", () => {
    const vars = segmentTextAreaLayoutVars(textStyle, 48, true);
    expect(vars["--seg-text-max-height"]).toBeUndefined();
  });
});
