import type { SegmentDto } from "../tauri/projectApi";

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
  selectionText: string;
};

export type SegmentContextMenuKey =
  | "delete"
  | "mergePrev"
  | "mergeNext"
  | "mergeRange"
  | "splitAtPointer"
  | "markFinalized";

export type SegmentContextMenuItem = {
  key: SegmentContextMenuKey;
  label: string;
  disabled: boolean;
};

export function buildSegmentContextMenuItems(args: {
  segmentIdx: number;
  segments: SegmentDto[];
  busy: boolean;
  pointerTimeSec: number;
  origin: SegmentContextMenuOrigin;
  canFinalize?: boolean;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
}): SegmentContextMenuItem[] {
  const {
    segmentIdx: i,
    segments,
    busy,
    pointerTimeSec,
    origin,
    canFinalize = false,
    selectionLo = i,
    selectionHi = i,
    selectionCount = 1,
  } = args;
  const n = segments.length;
  const seg = segments[i];
  const multi = selectionCount > 1;

  if (multi) {
    const items: SegmentContextMenuItem[] = [
      { key: "markFinalized", label: "标记定稿", disabled: true },
      {
        key: "mergeRange",
        label: `合并 ${selectionCount} 条语段`,
        disabled: busy || selectionLo >= selectionHi,
      },
      {
        key: "delete",
        label: `删除 ${selectionCount} 条语段`,
        disabled: busy || n === 0,
      },
    ];
    if (origin === "waveform") {
      items.push({ key: "splitAtPointer", label: "在指针时间拆分", disabled: true });
    }
    return items;
  }

  const canMergePrev = i >= 0 && i > 0 && !busy;
  const canMergeNext = i >= 0 && i < n - 1 && !busy;
  const items: SegmentContextMenuItem[] = [
    { key: "markFinalized", label: "标记定稿", disabled: busy || !canFinalize },
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
