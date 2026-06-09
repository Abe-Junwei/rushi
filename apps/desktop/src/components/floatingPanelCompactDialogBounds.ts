import { readFloatingPanelViewport } from "./floatingPanelViewport";

const COMPACT_DIALOG_MARGIN = 24;
const COMPACT_DIALOG_MAX_WIDTH = 560;
const COMPACT_DIALOG_MAX_HEIGHT = 720;

export type CompactDialogBoundsOptions = {
  margin?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidthCap?: number;
  maxHeightCap?: number;
};

/** compactDialog 视口内 min/max；避免 minHeight 大于 preset maxHeight 导致无法缩放与裁切。 */
export function resolveCompactDialogBounds(options: CompactDialogBoundsOptions = {}) {
  const margin = options.margin ?? COMPACT_DIALOG_MARGIN;
  const minWidth = options.minWidth ?? 280;
  const minHeight = options.minHeight ?? 180;
  const maxWidthCap = options.maxWidthCap ?? COMPACT_DIALOG_MAX_WIDTH;
  const maxHeightCap = options.maxHeightCap ?? COMPACT_DIALOG_MAX_HEIGHT;
  const viewport = readFloatingPanelViewport();
  const maxWidth = Math.min(maxWidthCap, Math.max(minWidth, viewport.width - margin * 2));
  const maxHeight = Math.min(maxHeightCap, Math.max(minHeight, viewport.height - margin * 2));
  return { margin, minWidth, minHeight, maxWidth, maxHeight };
}
