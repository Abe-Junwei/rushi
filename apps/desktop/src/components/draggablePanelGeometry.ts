import { readFloatingPanelViewport } from "./floatingPanelViewport";

export type PanelPosition = { x: number; y: number };
export type PanelSize = { width: number; height: number };

export function samePanelPosition(a: PanelPosition, b: PanelPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function samePanelSize(a: PanelSize, b: PanelSize): boolean {
  return a.width === b.width && a.height === b.height;
}

export function resolveContentFitTargetHeight(args: {
  contentFitHeight?: number;
  maxHeight?: number;
  minHeight: number;
  viewportMargin: number;
}): number | null {
  if (args.contentFitHeight == null) return null;
  const viewport = readFloatingPanelViewport();
  const viewportMaxHeight = Math.max(180, viewport.height - args.viewportMargin * 2);
  const effectiveMinHeight = Math.min(args.minHeight, viewportMaxHeight);
  const cap = args.maxHeight != null ? Math.min(args.maxHeight, viewportMaxHeight) : viewportMaxHeight;
  return Math.min(cap, Math.max(effectiveMinHeight, args.contentFitHeight));
}
