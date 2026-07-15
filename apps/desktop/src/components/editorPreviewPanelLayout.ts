import { readFloatingPanelViewport } from "./floatingPanelViewport";

/** 智能改稿 / 规则纠错预览：列表区水平内边距（与 findReplace 对齐）。 */
export const EDITOR_PREVIEW_PANEL_LIST_PADDING_CLASS = "px-3 pt-1 pb-3";

const PREVIEW_MARGIN = 16;
const PREVIEW_MIN_WIDTH = 480;
const PREVIEW_DEFAULT_WIDTH = 600;
const PREVIEW_MAX_WIDTH_CAP = 860;
const PREVIEW_MAX_HEIGHT_CAP = 840;
const PREVIEW_DEFAULT_HEIGHT = 420;

/** 改稿类预览浮层：较默认 compactDialog 更宽，高度由 autoFit 贴合内容并视口封顶。 */
export function resolveEditorPreviewPanelBounds() {
  const viewport = readFloatingPanelViewport();
  const maxWidth = Math.min(
    PREVIEW_MAX_WIDTH_CAP,
    Math.max(PREVIEW_MIN_WIDTH, viewport.width - PREVIEW_MARGIN * 2),
  );
  const maxHeight = Math.min(
    PREVIEW_MAX_HEIGHT_CAP,
    Math.max(360, viewport.height - PREVIEW_MARGIN * 2),
  );
  return {
    margin: PREVIEW_MARGIN,
    minWidth: Math.min(PREVIEW_MIN_WIDTH, maxWidth),
    maxWidth,
    maxHeight,
    defaultWidth: Math.min(PREVIEW_DEFAULT_WIDTH, maxWidth),
    fallbackHeight: Math.min(PREVIEW_DEFAULT_HEIGHT, maxHeight),
  };
}
