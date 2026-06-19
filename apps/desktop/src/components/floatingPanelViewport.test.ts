import { describe, expect, it, afterEach } from "vitest";
import {
  centerFloatingPanelPosition,
  EDITOR_WORKBENCH_TOOLBAR_SELECTOR,
  isFloatingPanelCentered,
  reconcileFloatingPanelOnViewportResize,
  resolveEditorWorkbenchFloatingPanelPosition,
  resolveFloatingPanelInitialState,
  shouldRecenterFloatingPanel,
} from "./floatingPanelViewport";

describe("floatingPanelViewport", () => {
  it("recenters when saved viewport width changed", () => {
    const saved = {
      position: { x: 900, y: 120 },
      size: { width: 420, height: 400 },
      viewport: { width: 1920, height: 1080 },
    };
    const viewport = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    expect(shouldRecenterFloatingPanel(saved, viewport)).toBe(true);
    const centered = centerFloatingPanelPosition(saved.size, 24, viewport);
    expect(centered.x).toBe(24 + Math.round((1200 - 48 - 420) / 2));
  });

  it("keeps saved position when viewport unchanged", () => {
    const saved = {
      position: { x: 300, y: 200 },
      size: { width: 420, height: 400 },
      viewport: { width: 1200, height: 800 },
    };
    const viewport = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    expect(shouldRecenterFloatingPanel(saved, viewport)).toBe(false);
  });

  it("recenters legacy saved state without viewport fingerprint when off-center", () => {
    const saved = {
      position: { x: 900, y: 100 },
      size: { width: 400, height: 360 },
    };
    const viewport = { width: 1100, height: 700, offsetX: 0, offsetY: 0 };
    expect(shouldRecenterFloatingPanel(saved, viewport)).toBe(true);
  });

  it("resolveFloatingPanelInitialState recenters on viewport mismatch", () => {
    const out = resolveFloatingPanelInitialState({
      saved: {
        position: { x: 900, y: 100 },
        size: { width: 400, height: 360 },
        viewport: { width: 1800, height: 1000 },
      },
      defaultPosition: { x: 0, y: 0 },
      defaultSize: { width: 400, height: 360 },
      margin: 16,
      clamp: (position, size) => ({ position, size }),
      viewport: { width: 1100, height: 700, offsetX: 0, offsetY: 0 },
    });
    expect(out.position.x).toBe(16 + Math.round((1100 - 32 - 400) / 2));
  });

  it("resolveFloatingPanelInitialState uses preferredDefaultPosition for legacy centered save", () => {
    const viewport = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    const size = { width: 420, height: 400 };
    const centered = centerFloatingPanelPosition(size, 16, viewport);
    const workbench = { x: 100, y: 520 };
    const out = resolveFloatingPanelInitialState({
      saved: {
        position: centered,
        size,
        viewport: { width: viewport.width, height: viewport.height },
      },
      defaultPosition: centered,
      defaultSize: size,
      margin: 16,
      clamp: (position, s) => ({ position, size: s }),
      viewport,
      preferredDefaultPosition: () => workbench,
    });
    expect(out.position).toEqual(workbench);
  });

  it("resolveEditorWorkbenchFloatingPanelPosition anchors below workbench toolbar", () => {
    const toolbar = document.createElement("div");
    toolbar.className = "editor-workbench-toolbar";
    document.body.appendChild(toolbar);
    toolbar.getBoundingClientRect = () =>
      ({
        bottom: 420,
        top: 372,
        left: 0,
        right: 1200,
        width: 1200,
        height: 48,
        x: 0,
        y: 372,
        toJSON: () => ({}),
      });

    const viewport = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    const size = { width: 520, height: 400 };
    const pos = resolveEditorWorkbenchFloatingPanelPosition(size, 16, viewport);
    expect(pos.y).toBe(384);
    expect(pos.x).toBe(16 + Math.round((1200 - 32 - 520) / 2));
    toolbar.remove();
  });

  afterEach(() => {
    document.querySelector(EDITOR_WORKBENCH_TOOLBAR_SELECTOR)?.remove();
  });

  it("reconcileFloatingPanelOnViewportResize recenters centered panel on fullscreen", () => {
    const size = { width: 420, height: 400 };
    const windowed = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    const fullscreen = { width: 1920, height: 1080, offsetX: 0, offsetY: 0 };
    const centered = centerFloatingPanelPosition(size, 16, windowed);
    expect(isFloatingPanelCentered(centered, size, windowed, 16)).toBe(true);
    const out = reconcileFloatingPanelOnViewportResize({
      position: centered,
      size,
      prevViewport: windowed,
      nextViewport: fullscreen,
      margin: 16,
      userMoved: false,
    });
    expect(out.recentered).toBe(true);
    expect(out.position.x).toBe(centerFloatingPanelPosition(size, 16, fullscreen).x);
  });

  it("reconcileFloatingPanelOnViewportResize follows small viewport changes without threshold lag", () => {
    const size = { width: 420, height: 400 };
    const prev = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    const next = { width: 1210, height: 800, offsetX: 0, offsetY: 0 };
    const centered = centerFloatingPanelPosition(size, 16, prev);
    const out = reconcileFloatingPanelOnViewportResize({
      position: centered,
      size,
      prevViewport: prev,
      nextViewport: next,
      margin: 16,
      userMoved: false,
    });
    expect(out.recentered).toBe(true);
    expect(out.position.x).toBe(centerFloatingPanelPosition(size, 16, next).x);
  });

  it("reconcileFloatingPanelOnViewportResize keeps user-dragged off-center position", () => {
    const size = { width: 420, height: 400 };
    const windowed = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    const fullscreen = { width: 1920, height: 1080, offsetX: 0, offsetY: 0 };
    const dragged = { x: 40, y: 80 };
    expect(isFloatingPanelCentered(dragged, size, windowed, 16)).toBe(false);
    const out = reconcileFloatingPanelOnViewportResize({
      position: dragged,
      size,
      prevViewport: windowed,
      nextViewport: fullscreen,
      margin: 16,
      userMoved: true,
    });
    expect(out.recentered).toBe(false);
    expect(out.position).toEqual(dragged);
  });

  it("reconcileFloatingPanelOnViewportResize re-anchors workbench panel instead of viewport center", () => {
    const size = { width: 520, height: 400 };
    const windowed = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    const resized = { width: 1100, height: 760, offsetX: 0, offsetY: 0 };
    const workbench = { x: 290, y: 384 };
    const nextWorkbench = { x: 240, y: 360 };
    const out = reconcileFloatingPanelOnViewportResize({
      position: workbench,
      size,
      prevViewport: windowed,
      nextViewport: resized,
      margin: 16,
      userMoved: false,
      preferredDefaultPosition: () => nextWorkbench,
    });
    expect(out.recentered).toBe(true);
    expect(out.position).toEqual(nextWorkbench);
    expect(isFloatingPanelCentered(out.position, size, resized, 16)).toBe(false);
  });

  it("reconcileFloatingPanelOnViewportResize keeps non-centered default without preferred anchor", () => {
    const size = { width: 420, height: 400 };
    const windowed = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };
    const resized = { width: 1100, height: 760, offsetX: 0, offsetY: 0 };
    const anchored = { x: 120, y: 520 };
    expect(isFloatingPanelCentered(anchored, size, windowed, 16)).toBe(false);
    const out = reconcileFloatingPanelOnViewportResize({
      position: anchored,
      size,
      prevViewport: windowed,
      nextViewport: resized,
      margin: 16,
      userMoved: false,
    });
    expect(out.recentered).toBe(false);
    expect(out.position).toEqual(anchored);
  });
});
