const VIEWPORT_PAD = 8;
const CURSOR_OFFSET = 2;

/** 将上下文菜单锚在指针附近并保持在可视区域内（使用实测宽高）。 */
export function clampContextMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } {
  if (typeof window === "undefined") {
    return { left: clientX + CURSOR_OFFSET, top: clientY + CURSOR_OFFSET };
  }
  const vv = window.visualViewport;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  const ox = vv?.offsetLeft ?? 0;
  const oy = vv?.offsetTop ?? 0;

  let left = clientX + CURSOR_OFFSET + ox;
  let top = clientY + CURSOR_OFFSET + oy;

  const minLeft = ox + VIEWPORT_PAD;
  const minTop = oy + VIEWPORT_PAD;
  const maxLeft = ox + vw - menuWidth - VIEWPORT_PAD;
  const maxTop = oy + vh - menuHeight - VIEWPORT_PAD;

  left = Math.min(Math.max(minLeft, left), Math.max(minLeft, maxLeft));
  top = Math.min(Math.max(minTop, top), Math.max(minTop, maxTop));

  return { left, top };
}

/** 打开前粗估尺寸，避免首帧测量前菜单跑出视口。 */
export function estimateContextMenuSize(itemCount: number): { width: number; height: number } {
  const width = 200;
  const rowPx = 36;
  const chromePx = 8;
  return { width, height: Math.max(72, itemCount * rowPx + chromePx) };
}
