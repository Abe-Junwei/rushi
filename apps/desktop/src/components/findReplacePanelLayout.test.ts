import { describe, expect, it } from "vitest";
import { resolveFindReplacePanelBounds } from "./findReplacePanelLayout";

describe("findReplacePanelLayout", () => {
  it("resolves viewport-clamped bounds with sane defaults", () => {
    const bounds = resolveFindReplacePanelBounds();
    expect(bounds.minWidth).toBeLessThanOrEqual(bounds.maxWidth);
    expect(bounds.minHeight).toBeLessThanOrEqual(bounds.maxHeight);
    expect(bounds.defaultWidth).toBeLessThanOrEqual(bounds.maxWidth);
    expect(bounds.previewWidth).toBeLessThanOrEqual(bounds.maxWidth);
    expect(bounds.margin).toBe(16);
  });
});
