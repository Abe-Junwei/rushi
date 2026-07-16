import { describe, expect, it } from "vitest";
import { panelResizeLocksAutoHeight } from "./draggablePanelDragResize";

describe("panelResizeLocksAutoHeight", () => {
  it("width-only handles do not lock auto height", () => {
    expect(panelResizeLocksAutoHeight("e")).toBe(false);
    expect(panelResizeLocksAutoHeight("w")).toBe(false);
  });

  it("height and corner handles lock auto height", () => {
    expect(panelResizeLocksAutoHeight("n")).toBe(true);
    expect(panelResizeLocksAutoHeight("s")).toBe(true);
    expect(panelResizeLocksAutoHeight("ne")).toBe(true);
    expect(panelResizeLocksAutoHeight("se")).toBe(true);
    expect(panelResizeLocksAutoHeight("nw")).toBe(true);
    expect(panelResizeLocksAutoHeight("sw")).toBe(true);
  });
});
