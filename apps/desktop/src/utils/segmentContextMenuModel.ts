import type { SegmentDto } from "../tauri/projectApi";

/**
 * 语段卡右键「在指针时间拆分」：用卡内水平点击位置线性映射到 [start_sec, end_sec]（计划 C 默认规则）。
 * 波形区仍用 `clientXToTimeSec` 得到 `pointerTimeSec`。
 */
export function pointerTimeFromSegmentCard(
  clientX: number,
  cardRect: Pick<DOMRect, "left" | "width">,
  seg: Pick<SegmentDto, "start_sec" | "end_sec">,
): number {
  const w = Math.max(cardRect.width, 1e-6);
  const frac = Math.min(1, Math.max(0, (clientX - cardRect.left) / w));
  return seg.start_sec + frac * (seg.end_sec - seg.start_sec);
}

export type SegmentContextMenuOrigin = "segmentList" | "waveform";

export type SegmentContextMenuOpen = {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
  origin: SegmentContextMenuOrigin;
};

export type SegmentContextMenuKey = "delete" | "mergePrev" | "mergeNext" | "splitAtPointer";

export type SegmentContextMenuItem = {
  key: SegmentContextMenuKey;
  label: string;
  disabled: boolean;
};

/**
 * 语段右键菜单（删 / 并上 / 并下；「在指针时间拆分」仅波形区）。
 * `pointerTimeSec`：波形区为鼠标 X 对应时间轴秒。
 */
export function buildSegmentContextMenuItems(args: {
  segmentIdx: number;
  segments: SegmentDto[];
  busy: boolean;
  pointerTimeSec: number;
  origin: SegmentContextMenuOrigin;
}): SegmentContextMenuItem[] {
  const { segmentIdx: i, segments, busy, pointerTimeSec, origin } = args;
  const n = segments.length;
  const seg = segments[i];
  const canMergePrev = i >= 0 && i > 0 && !busy;
  const canMergeNext = i >= 0 && i < n - 1 && !busy;
  const items: SegmentContextMenuItem[] = [
    { key: "delete", label: "删除", disabled: busy || n === 0 },
    { key: "mergePrev", label: "与上一条合并", disabled: !canMergePrev },
    { key: "mergeNext", label: "与下一条合并", disabled: !canMergeNext },
  ];
  if (origin !== "waveform") return items;

  let canSplit = i >= 0 && Boolean(seg) && !busy && n > 0;
  if (canSplit && seg) {
    const t = pointerTimeSec;
    canSplit = t > seg.start_sec + 0.02 && t < seg.end_sec - 0.02;
  }
  items.push({ key: "splitAtPointer", label: "在指针时间拆分", disabled: !canSplit });
  return items;
}
