/** 浮动面板 / 居中对话框 Esc 关闭（UI 提示真源）。 */
export const DIALOG_ESCAPE_KEYS_LABEL = "Esc";

export function dialogCloseButtonTitle(): string {
  return `关闭 (${DIALOG_ESCAPE_KEYS_LABEL})`;
}

export function dialogPanelTitleBarHint(autoHeight: boolean): string {
  const resize = "拖边或角调整大小";
  const move = "拖拽标题栏移动";
  if (autoHeight) {
    return `${move}；${resize}；双击恢复自动高度`;
  }
  return `${move}；${resize}`;
}
