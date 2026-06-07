export type SegmentTextContextMenuAction = { kind: "textMenu"; selectionText: string };

/** pointerdown（右键）瞬间的选区快照；contextmenu 时 WebKit 常会改选区，不可信。 */
export type SegmentTextContextMenuSelectionSnapshot = {
  start: number;
  end: number;
  collapsed: boolean;
};

/**
 * 正文区右键：有刻意选区时仅纳入更正记忆；否则由 buildSegmentRowContextMenuItems 合并语段操作与文本外观。
 */
export function resolveSegmentTextContextMenuAction(args: {
  snapshot: SegmentTextContextMenuSelectionSnapshot | null;
  value: string;
}): SegmentTextContextMenuAction {
  const { snapshot, value } = args;
  if (!snapshot || snapshot.collapsed) {
    return { kind: "textMenu", selectionText: "" };
  }
  const selectionText = value
    .slice(Math.min(snapshot.start, snapshot.end), Math.max(snapshot.start, snapshot.end))
    .trim();
  if (!selectionText) {
    return { kind: "textMenu", selectionText: "" };
  }
  return { kind: "textMenu", selectionText };
}

/** 右键菜单打开后恢复 pointerdown 时的选区，避免 WebKit 误选一字。 */
export function restoreSegmentTextContextMenuSelection(
  el: HTMLTextAreaElement,
  snapshot: SegmentTextContextMenuSelectionSnapshot | null,
): void {
  if (!snapshot) return;
  if (snapshot.collapsed) {
    el.setSelectionRange(snapshot.start, snapshot.start);
  } else {
    el.setSelectionRange(snapshot.start, snapshot.end);
  }
  // setSelectionRange 在 WebKit 上会重新聚焦 textarea，导致自定义菜单首击被派给正文而非菜单项。
  if (document.activeElement === el) {
    el.blur();
  }
}
