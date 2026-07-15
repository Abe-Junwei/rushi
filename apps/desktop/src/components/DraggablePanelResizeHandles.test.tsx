// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraggablePanelResizeHandles } from "./DraggablePanelResizeHandles";

describe("DraggablePanelResizeHandles", () => {
  it("renders eight edge and corner resize handles", () => {
    const { container } = render(
      <DraggablePanelResizeHandles onPointerDown={() => {}} />,
    );
    const handles = container.querySelectorAll(".floating-panel-resize-handle");
    expect(handles.length).toBe(8);
    for (const mode of ["n", "s", "w", "e", "nw", "ne", "sw", "se"]) {
      expect(container.querySelector(`.floating-panel-resize-handle--${mode}`)).toBeTruthy();
    }
  });
});
