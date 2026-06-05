import { describe, expect, it } from "vitest";
import {
  centerFloatingPanelPosition,
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
});
