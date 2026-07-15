import { describe, expect, it, vi } from "vitest";
import * as floatingPanelViewport from "./floatingPanelViewport";
import { resolveEditorPreviewPanelBounds } from "./editorPreviewPanelLayout";

describe("resolveEditorPreviewPanelBounds", () => {
  it("defaults wider than legacy 480/520 preview panels on desktop viewport", () => {
    vi.spyOn(floatingPanelViewport, "readFloatingPanelViewport").mockReturnValue({
      width: 1280,
      height: 900,
      offsetX: 0,
      offsetY: 0,
    });
    const bounds = resolveEditorPreviewPanelBounds();
    expect(bounds.defaultWidth).toBe(600);
    expect(bounds.maxWidth).toBe(860);
    expect(bounds.maxHeight).toBe(840);
  });
});
