import type { SegmentDto } from "../tauri/p1Api";

/**
 * 语段卡右键「在指针时间拆分」：用卡内水平点击位置线性映射到 [start_sec, end_sec]（计划 C 默认规则）。
 * 波形区仍用 `clientXToTimeSec` 得到 `pointerTimeSec`。
 */
export function p1PointerTimeFromSegmentCard(
  clientX: number,
  cardRect: Pick<DOMRect, "left" | "width">,
  seg: Pick<SegmentDto, "start_sec" | "end_sec">,
): number {
  const w = Math.max(cardRect.width, 1e-6);
  const frac = Math.min(1, Math.max(0, (clientX - cardRect.left) / w));
  return seg.start_sec + frac * (seg.end_sec - seg.start_sec);
}

export type P1SegmentContextMenuKey = "delete" | "mergePrev" | "mergeNext" | "splitAtPointer";

export type P1SegmentContextMenuItem = {
  key: P1SegmentContextMenuKey;
  label: string;
  disabled: boolean;
};

/**
 * 波形与语段卡共用的右键菜单项（删 / 并上 / 并下 / 在指针时间拆分）。
 * `pointerTimeSec`：波形区为鼠标 X 对应时间轴秒；语段卡为卡内点击映射秒（见 `p1PointerTimeFromSegmentCard`）。
 */
export function buildP1SegmentContextMenuItems(args: {
  segmentIdx: number;
  segments: SegmentDto[];
  busy: boolean;
  pointerTimeSec: number;
}): P1SegmentContextMenuItem[] {
  const { segmentIdx: i, segments, busy, pointerTimeSec } = args;
  const n = segments.length;
  const seg = segments[i];
  const canMergePrev = i > 0 && !busy;
  const canMergeNext = i < n - 1 && !busy;
  let canSplit = Boolean(seg) && !busy && n > 0;
  if (canSplit && seg) {
    const t = pointerTimeSec;
    canSplit = t > seg.start_sec + 0.02 && t < seg.end_sec - 0.02;
  }
  return [
    { key: "delete", label: "删除", disabled: busy || n === 0 },
    { key: "mergePrev", label: "与上一条合并", disabled: !canMergePrev },
    { key: "mergeNext", label: "与下一条合并", disabled: !canMergeNext },
    { key: "splitAtPointer", label: "在指针时间拆分", disabled: !canSplit },
  ];
}
