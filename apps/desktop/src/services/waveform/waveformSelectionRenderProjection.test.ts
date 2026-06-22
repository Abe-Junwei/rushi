import { describe, expect, it } from "vitest";
import {
  resolveWaveformSelectionRenderProjection,
  selectWaveformOverlayInteractiveIndices,
} from "./waveformSelectionRenderProjection";

describe("waveformSelectionRenderProjection", () => {
  it("keeps primary on canvas when overlay DOM is missing", () => {
    const projection = resolveWaveformSelectionRenderProjection({
      segmentCount: 5,
      selectedIdx: 3,
      draftIdx: null,
      overlayRoot: null,
    });

    expect(projection.overlayInteractiveIndices).toEqual([3]);
    expect(projection.canvasSkipIndexSet.has(3)).toBe(false);
    expect(projection.fallbackTargetIdx).toBe(3);
  });

  it("uses draft as fallback target when draft overlay DOM is missing", () => {
    const overlay = document.createElement("div");
    overlay.innerHTML = '<div data-segment-idx="1"></div>';

    const projection = resolveWaveformSelectionRenderProjection({
      segmentCount: 5,
      selectedIdx: 1,
      draftIdx: 3,
      overlayRoot: overlay,
    });

    expect(projection.canvasSkipIndexSet.has(1)).toBe(true);
    expect(projection.canvasSkipIndexSet.has(3)).toBe(false);
    expect(projection.fallbackTargetIdx).toBe(3);
  });

  it("skips primary on canvas when overlay DOM owns it", () => {
    const overlay = document.createElement("div");
    overlay.innerHTML = '<div data-segment-idx="3"></div>';

    const projection = resolveWaveformSelectionRenderProjection({
      segmentCount: 5,
      selectedIdx: 3,
      draftIdx: null,
      overlayRoot: overlay,
    });

    expect(projection.canvasSkipIndexSet.has(3)).toBe(true);
    expect(projection.fallbackTargetIdx).toBeNull();
  });

  it("caps sparse overlay indices while canvas remains responsible for omitted selections", () => {
    const selectedIndices = new Set<number>();
    for (let i = 0; i < 80; i += 2) selectedIndices.add(i);

    const overlayInteractiveIndices = selectWaveformOverlayInteractiveIndices({
      segmentCount: 80,
      selectedIdx: 40,
      selectedIndices,
      selectionLo: 0,
      selectionHi: 78,
      selectionCount: 40,
      isContiguousSelection: false,
      draftIdx: 79,
    });

    expect(overlayInteractiveIndices.length).toBeLessThan(40);
    expect(overlayInteractiveIndices).toContain(40);
    expect(overlayInteractiveIndices).toContain(79);
  });
});
