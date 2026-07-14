import type { SegmentDto } from "../tauri/projectApi";
import type { EditorShortcutId } from "./editorShortcutRegistry";
import { editorShortcutMenuHint } from "./editorShortcutMenuHint";

function menuItemWithShortcut(
  item: Omit<SegmentContextMenuItem, "shortcutHint" | "disabled"> & { disabled?: boolean },
  shortcutId: EditorShortcutId,
): SegmentContextMenuItem {
  return { ...item, disabled: item.disabled ?? false, shortcutHint: editorShortcutMenuHint(shortcutId) };
}

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
  /** Kept for ContextMenuItem compat; builders omit unavailable actions instead of greying. */
  disabled: boolean;
  shortcutHint?: string;
};

/**
 * Structure ops for waveform / list menus.
 * Unavailable actions are omitted (not greyed out).
 *
 * Order: 定稿 → 合并 → 删除 →（波形）拆分
 */
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
  isContiguousSelection?: boolean;
  /** True when any segment in the current selection is frozen. */
  frozenInSelection?: boolean;
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
    isContiguousSelection = true,
  } = args;
  const n = segments.length;
  const seg = segments[i];
  const multi = selectionCount > 1;
  const targetFrozen = Boolean(seg?.frozen);
  const structureLocked = Boolean(args.frozenInSelection) || targetFrozen;

  if (busy) return [];

  if (multi) {
    const items: SegmentContextMenuItem[] = [];
    if (
      !structureLocked &&
      selectionLo < selectionHi &&
      isContiguousSelection
    ) {
      items.push(
        menuItemWithShortcut(
          { key: "mergeRange", label: `合并 ${selectionCount} 条语段` },
          "segment.mergeNext",
        ),
      );
    }
    if (!structureLocked && n > 0) {
      items.push(
        menuItemWithShortcut(
          { key: "delete", label: `删除 ${selectionCount} 条语段` },
          "segment.delete",
        ),
      );
    }
    return items;
  }

  if (structureLocked || targetFrozen) return [];

  const items: SegmentContextMenuItem[] = [];
  if (canFinalize) {
    items.push(
      menuItemWithShortcut({ key: "markFinalized", label: "标记定稿" }, "workflow.confirmAdvance"),
    );
  }
  if (i > 0 && !segments[i - 1]?.frozen) {
    items.push(
      menuItemWithShortcut({ key: "mergePrev", label: "与上一条合并" }, "segment.mergePrev"),
    );
  }
  if (i < n - 1 && !segments[i + 1]?.frozen) {
    items.push(
      menuItemWithShortcut({ key: "mergeNext", label: "与下一条合并" }, "segment.mergeNext"),
    );
  }
  if (n > 0) {
    items.push(menuItemWithShortcut({ key: "delete", label: "删除" }, "segment.delete"));
  }

  if (origin === "waveform" && seg) {
    const t = pointerTimeSec;
    const canSplit = t > seg.start_sec + 0.02 && t < seg.end_sec - 0.02;
    if (canSplit) {
      items.push({ key: "splitAtPointer", label: "在指针时间拆分", disabled: false });
    }
  }
  return items;
}
