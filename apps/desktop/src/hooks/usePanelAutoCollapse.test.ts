/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePanelAutoCollapse } from "./usePanelAutoCollapse";

function firePointerDown(target: Element) {
  const event =
    typeof PointerEvent !== "undefined"
      ? new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
      : new Event("pointerdown", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
}

describe("usePanelAutoCollapse", () => {
  it("collapses when clicking inside boundary but outside panel", () => {
    const setIsCollapsed = vi.fn();
    const boundary = document.createElement("div");
    const panel = document.createElement("aside");
    panel.setAttribute("data-panel", "");
    const main = document.createElement("main");
    boundary.append(panel, main);
    document.body.appendChild(boundary);

    renderHook(() =>
      usePanelAutoCollapse({
        enabled: true,
        isCollapsed: false,
        setIsCollapsed,
        boundaryRef: { current: boundary },
        panelSelector: "[data-panel]",
      }),
    );

    firePointerDown(main);
    expect(setIsCollapsed).toHaveBeenCalledWith(true);

    document.body.removeChild(boundary);
  });

  it("does not collapse when clicking panel or toggle", () => {
    const setIsCollapsed = vi.fn();
    const boundary = document.createElement("div");
    const panel = document.createElement("aside");
    panel.setAttribute("data-panel", "");
    const toggle = document.createElement("button");
    toggle.setAttribute("data-toggle", "");
    boundary.append(panel, toggle);
    document.body.appendChild(boundary);

    renderHook(() =>
      usePanelAutoCollapse({
        enabled: true,
        isCollapsed: false,
        setIsCollapsed,
        boundaryRef: { current: boundary },
        panelSelector: "[data-panel]",
        toggleSelector: "[data-toggle]",
      }),
    );

    firePointerDown(panel);
    firePointerDown(toggle);
    expect(setIsCollapsed).not.toHaveBeenCalled();

    document.body.removeChild(boundary);
  });

  it("is inactive when already collapsed or disabled", () => {
    const setIsCollapsed = vi.fn();
    const boundary = document.createElement("div");
    const main = document.createElement("main");
    boundary.append(main);
    document.body.appendChild(boundary);

    const { rerender } = renderHook(
      ({ enabled, isCollapsed }: { enabled: boolean; isCollapsed: boolean }) =>
        usePanelAutoCollapse({
          enabled,
          isCollapsed,
          setIsCollapsed,
          boundaryRef: { current: boundary },
          panelSelector: "[data-panel]",
        }),
      { initialProps: { enabled: false, isCollapsed: false } },
    );

    firePointerDown(main);
    expect(setIsCollapsed).not.toHaveBeenCalled();

    rerender({ enabled: true, isCollapsed: true });
    firePointerDown(main);
    expect(setIsCollapsed).not.toHaveBeenCalled();

    document.body.removeChild(boundary);
  });

  it("collapses when bubble phase stops propagation on target", () => {
    const setIsCollapsed = vi.fn();
    const boundary = document.createElement("div");
    const panel = document.createElement("aside");
    panel.setAttribute("data-panel", "");
    const main = document.createElement("main");
    main.addEventListener("pointerdown", (e) => e.stopPropagation());
    boundary.append(panel, main);
    document.body.appendChild(boundary);

    renderHook(() =>
      usePanelAutoCollapse({
        enabled: true,
        isCollapsed: false,
        setIsCollapsed,
        boundaryRef: { current: boundary },
        panelSelector: "[data-panel]",
      }),
    );

    firePointerDown(main);
    expect(setIsCollapsed).toHaveBeenCalledWith(true);

    document.body.removeChild(boundary);
  });
});
