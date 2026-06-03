export type SegmentTextContextMenuAction =
  | { kind: "row" }
  | { kind: "correctionMemory"; selectionText: string };

/**
 * 右键菜单前是否无选区（在 pointerdown capture 记录）。
 * WebKit 常在 contextmenu 时自动选中光标处一字（尤其段末标点），不得据此打开「纳入更正记忆」。
 */
export function resolveSegmentTextContextMenuAction(args: {
  wasCollapsedBeforeContextMenu: boolean;
  selectionStart: number;
  selectionEnd: number;
  value: string;
}): SegmentTextContextMenuAction {
  const { wasCollapsedBeforeContextMenu, selectionStart, selectionEnd, value } = args;
  if (selectionStart === selectionEnd) {
    return { kind: "row" };
  }
  if (wasCollapsedBeforeContextMenu) {
    return { kind: "row" };
  }
  const selectionText = value.slice(selectionStart, selectionEnd);
  if (!selectionText.trim()) {
    return { kind: "row" };
  }
  return { kind: "correctionMemory", selectionText };
}
