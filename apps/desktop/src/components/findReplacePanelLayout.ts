import { readFloatingPanelViewport } from "./floatingPanelViewport";

/** 查找替换浮层正文水平内边距（较 compactDialog 默认 px-5 更紧，避免输入区两侧留白过大）。 */
export const FIND_REPLACE_PANEL_BODY_PADDING_CLASS = "px-3 pt-3";

/** 查找替换结果列表区水平内边距（与表单对齐）。 */
export const FIND_REPLACE_PANEL_LIST_PADDING_CLASS = "px-3 pt-1 pb-3";

/** Editor 浮层（findReplace preset）视口 bounds。 */
export function resolveFindReplacePanelBounds() {
  const viewport = readFloatingPanelViewport();
  const margin = 16;
  const maxW = Math.min(640, Math.max(320, viewport.width - margin * 2));
  const maxH = Math.min(720, Math.max(280, viewport.height - margin * 2));
  return {
    margin,
    minWidth: Math.min(400, maxW),
    minHeight: Math.min(280, maxH),
    maxWidth: maxW,
    maxHeight: maxH,
    defaultWidth: Math.min(480, maxW),
    previewWidth: Math.min(520, maxW),
  };
}
