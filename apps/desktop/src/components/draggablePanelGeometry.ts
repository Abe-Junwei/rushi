import { readFloatingPanelViewport, type FloatingPanelViewport } from "./floatingPanelViewport";

export type PanelPosition = { x: number; y: number };
export type PanelSize = { width: number; height: number };

/** 高度真源模式：auto = 内容贴合（CSS height:auto + max-height 封顶）；manual = 固定 px。 */
export type PanelHeightMode = "auto" | "manual";

export function samePanelPosition(a: PanelPosition, b: PanelPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function samePanelSize(a: PanelSize, b: PanelSize): boolean {
  return a.width === b.width && a.height === b.height;
}

/** auto 模式壳层 max-height：居中=视口封顶；已移动=从 top 到底边的可用高度。 */
export function resolvePanelMaxHeightCap(args: {
  viewport: FloatingPanelViewport;
  margin: number;
  centered: boolean;
  top: number;
  maxHeight?: number;
}): number {
  const viewportCap = Math.max(120, args.viewport.height - args.margin * 2);
  let cap = viewportCap;
  if (!args.centered) {
    const fromTop = args.viewport.height + args.viewport.offsetY - args.top - args.margin;
    cap = Math.max(120, Math.min(viewportCap, fromTop));
  }
  return args.maxHeight != null ? Math.min(args.maxHeight, cap) : cap;
}

export type PanelLayoutRules = {
  left: string | number;
  top: string | number;
  width: number;
  zIndex: number;
  transform: string | null;
  height: number | string | null;
  maxHeight: number | null;
};

/**
 * 壳层定位/尺寸的唯一真源：
 * - auto + 居中 → transform 垂直居中 + height:auto + max-height 封顶
 * - auto + 已移动 → 定位 top + height:auto + max-height（从 top 到底边）
 * - manual → 固定 px height（居中时用 calc 垂直居中）
 */
export function resolvePanelLayout(args: {
  heightMode: PanelHeightMode;
  centered: boolean;
  position: PanelPosition;
  size: PanelSize;
  zIndex: number;
  maxHeightCap: number;
}): PanelLayoutRules {
  const { heightMode, centered, position, size, zIndex, maxHeightCap } = args;
  const left = centered ? `calc(50vw - ${size.width / 2}px)` : position.x;

  if (heightMode === "auto") {
    return {
      left,
      top: centered ? "50%" : position.y,
      transform: centered ? "translateY(-50%)" : null,
      width: size.width,
      height: "auto",
      maxHeight: maxHeightCap,
      zIndex,
    };
  }

  return {
    left,
    top: centered ? `calc(50vh - ${size.height / 2}px)` : position.y,
    transform: null,
    width: size.width,
    height: Math.min(size.height, maxHeightCap),
    maxHeight: null,
    zIndex,
  };
}

/** 拖拽 resize 起手：从渲染矩形读取实际位置/高度，作为切换到 manual 模式的 px 基线。 */
export function readPanelRenderedRect(
  element: HTMLElement | null,
  fallback: { position: PanelPosition; size: PanelSize },
): { position: PanelPosition; size: PanelSize } {
  if (!element) return fallback;
  const rect = element.getBoundingClientRect();
  const viewport = readFloatingPanelViewport();
  if (rect.width <= 0 || rect.height <= 0) return fallback;
  return {
    position: { x: rect.left + viewport.offsetX, y: rect.top + viewport.offsetY },
    size: { width: Math.round(rect.width), height: Math.round(rect.height) },
  };
}
