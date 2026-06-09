import { describe, expect, it } from "vitest";
import { resolveCompactDialogBounds } from "./floatingPanelCompactDialogBounds";

describe("resolveCompactDialogBounds", () => {
  it("never returns maxHeight below minHeight", () => {
    const bounds = resolveCompactDialogBounds({ minWidth: 320, minHeight: 320 });
    expect(bounds.maxHeight).toBeGreaterThanOrEqual(bounds.minHeight);
    expect(bounds.maxWidth).toBeGreaterThanOrEqual(bounds.minWidth);
  });
});
