import type { PanelPosition, PanelSize } from "../components/draggablePanelGeometry";
import { readFloatingPanelViewport } from "../components/floatingPanelViewport";

export type DragResizeViewportBounds = {
  effectiveMinWidth: number;
  effectiveMaxWidth: number;
  effectiveMinHeight: number;
};

export function resolveDragResizeViewportBounds(input: {
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  viewportMargin: number;
}): DragResizeViewportBounds {
  const { minWidth, minHeight, maxWidth, viewportMargin } = input;
  const viewport = readFloatingPanelViewport();
  const viewportMaxWidth = Math.max(240, viewport.width - viewportMargin * 2);
  const viewportMaxHeight = Math.max(180, viewport.height - viewportMargin * 2);
  const effectiveMaxWidth = maxWidth != null ? Math.min(maxWidth, viewportMaxWidth) : viewportMaxWidth;
  return {
    effectiveMinWidth: Math.min(minWidth, effectiveMaxWidth),
    effectiveMaxWidth,
    effectiveMinHeight: Math.min(minHeight, viewportMaxHeight),
  };
}

export function computeDragResizeState(
  mode: string,
  dx: number,
  dy: number,
  startPos: PanelPosition,
  startSize: PanelSize,
  bounds: DragResizeViewportBounds,
): { position: PanelPosition; size: PanelSize } {
  let nextX = startPos.x;
  let nextY = startPos.y;
  let nextW = startSize.width;
  let nextH = startSize.height;
  const { effectiveMinWidth, effectiveMaxWidth, effectiveMinHeight } = bounds;

  if (mode.includes("e")) {
    nextW = Math.min(effectiveMaxWidth, Math.max(effectiveMinWidth, startSize.width + dx));
  }
  if (mode.includes("w")) {
    const newW = Math.min(effectiveMaxWidth, Math.max(effectiveMinWidth, startSize.width - dx));
    nextX = startPos.x + (startSize.width - newW);
    nextW = newW;
  }
  if (mode.includes("s")) {
    nextH = Math.max(effectiveMinHeight, startSize.height + dy);
  }
  if (mode.includes("n")) {
    const newH = Math.max(effectiveMinHeight, startSize.height - dy);
    nextY = startPos.y + (startSize.height - newH);
    nextH = newH;
  }

  return { position: { x: nextX, y: nextY }, size: { width: nextW, height: nextH } };
}
