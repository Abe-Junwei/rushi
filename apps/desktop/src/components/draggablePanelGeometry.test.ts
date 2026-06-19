import { describe, expect, it } from "vitest";
import {
  readPanelRenderedRect,
  resolvePanelLayout,
  resolvePanelMaxHeightCap,
} from "./draggablePanelGeometry";

const viewport = { width: 1200, height: 800, offsetX: 0, offsetY: 0 };

describe("resolvePanelMaxHeightCap", () => {
  it("centered caps at viewport minus 2*margin", () => {
    expect(resolvePanelMaxHeightCap({ viewport, margin: 16, centered: true, top: 0 })).toBe(768);
  });

  it("moved caps from top to bottom margin", () => {
    expect(resolvePanelMaxHeightCap({ viewport, margin: 16, centered: false, top: 200 })).toBe(
      800 - 200 - 16,
    );
  });

  it("never returns below the 120 floor", () => {
    expect(
      resolvePanelMaxHeightCap({ viewport, margin: 16, centered: false, top: 790 }),
    ).toBe(120);
  });

  it("respects an explicit maxHeight ceiling", () => {
    expect(
      resolvePanelMaxHeightCap({ viewport, margin: 16, centered: true, top: 0, maxHeight: 400 }),
    ).toBe(400);
  });
});

describe("resolvePanelLayout", () => {
  const base = { position: { x: 120, y: 90 }, size: { width: 420, height: 360 }, zIndex: 50 };

  it("auto + centered uses transform vertical centering and auto height", () => {
    const layout = resolvePanelLayout({
      heightMode: "auto",
      centered: true,
      maxHeightCap: 700,
      ...base,
    });
    expect(layout.left).toBe("calc(50vw - 210px)");
    expect(layout.top).toBe("50%");
    expect(layout.transform).toBe("translateY(-50%)");
    expect(layout.height).toBe("auto");
    expect(layout.maxHeight).toBe(700);
  });

  it("auto + moved positions by px without transform", () => {
    const layout = resolvePanelLayout({
      heightMode: "auto",
      centered: false,
      maxHeightCap: 500,
      ...base,
    });
    expect(layout.left).toBe(120);
    expect(layout.top).toBe(90);
    expect(layout.transform).toBeNull();
    expect(layout.height).toBe("auto");
    expect(layout.maxHeight).toBe(500);
  });

  it("manual + centered uses calc vertical centering and px height", () => {
    const layout = resolvePanelLayout({
      heightMode: "manual",
      centered: true,
      maxHeightCap: 700,
      ...base,
    });
    expect(layout.top).toBe("calc(50vh - 180px)");
    expect(layout.transform).toBeNull();
    expect(layout.height).toBe(360);
    expect(layout.maxHeight).toBeNull();
  });

  it("manual clamps px height to the cap", () => {
    const layout = resolvePanelLayout({
      heightMode: "manual",
      centered: false,
      maxHeightCap: 200,
      ...base,
    });
    expect(layout.height).toBe(200);
  });
});

describe("readPanelRenderedRect", () => {
  it("returns the fallback when element is null", () => {
    const fallback = { position: { x: 1, y: 2 }, size: { width: 3, height: 4 } };
    expect(readPanelRenderedRect(null, fallback)).toEqual(fallback);
  });
});
