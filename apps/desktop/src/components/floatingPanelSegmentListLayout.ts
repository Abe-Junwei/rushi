/** 单行语段预览行高（与 FloatingPanelSegmentRow py-1.5 + text-sm 对齐）。 */
export const FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX = 32;

/** 语段列表最多展示高度；超出后列表内滚动。 */
export const FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX = 256;

export function resolveFloatingPanelSegmentListHeight(rowCount: number): number {
  if (rowCount <= 0) return 0;
  const natural = rowCount * FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX;
  return Math.min(natural, FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX);
}

/** 查找替换主面板：标题栏 + 表单 + 状态 + 底栏（不含语段列表）。 */
export const FIND_REPLACE_PANEL_STATIC_BODY_PX = 281;

/** 全部替换预览：说明文案 + 底栏（不含语段列表）。 */
export const FIND_REPLACE_PREVIEW_STATIC_BODY_PX = 132;

/** 规则纠错预览：摘要 + 底栏（不含语段列表；只读 hints 折叠时额外增高由壳层滚动兜底）。 */
export const CORRECTION_RULES_PREVIEW_STATIC_BODY_PX = 168;

const FLOATING_PANEL_TITLE_BAR_PX = 57;

export function resolveFloatingPanelFitHeight(staticBodyPx: number, rowCount: number): number {
  const listHeight = resolveFloatingPanelSegmentListHeight(rowCount);
  return FLOATING_PANEL_TITLE_BAR_PX + staticBodyPx + listHeight;
}
