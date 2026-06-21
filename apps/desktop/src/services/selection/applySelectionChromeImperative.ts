import type { SegmentDto } from "../../tauri/projectApi";
import { setCspLayoutRules } from "../../utils/cspElementLayout";
import { waveformRegionFillColor } from "../../utils/segmentChrome";
import type { SelectionChromeSnapshot } from "./selectionChromeStore";

const ROW_SHELL_BASE =
  "seg-row-shell group relative cursor-text rounded-md border border-transparent px-[9px] py-[9px] transition-[background-color,border-color,box-shadow]";

function waveformSegmentEl(root: ParentNode, idx: number): HTMLElement | null {
  return root.querySelector(`[data-segment-idx="${idx}"]`) as HTMLElement | null;
}

function listRowEl(root: ParentNode, idx: number): HTMLElement | null {
  return root.querySelector(`[data-seg-row="${idx}"]`) as HTMLElement | null;
}

function applyWaveformSegmentLook(
  el: HTMLElement,
  seg: SegmentDto,
  selected: boolean,
  inSelection: boolean,
  multiSelectActive: boolean,
): void {
  el.classList.toggle("waveform-segment-region-selected", selected);
  el.classList.toggle("waveform-segment-region-in-selection", !selected && inSelection);
  setCspLayoutRules(el, {
    background: waveformRegionFillColor(seg, selected, inSelection, undefined, {
      multiSelectActive,
    }),
  });
}

function setRowShellClassTokens(el: HTMLElement, selected: boolean, inSelection: boolean): void {
  for (const token of ROW_SHELL_BASE.split(/\s+/)) {
    if (token) el.classList.add(token);
  }
  el.classList.remove(
    "seg-row-selected",
    "seg-row-in-selection",
    "bg-transparent",
    "hover:border-notion-divider",
    "hover:bg-notion-sidebar/35",
  );
  if (selected) {
    el.classList.add("seg-row-selected");
    return;
  }
  if (inSelection) {
    el.classList.add("seg-row-in-selection");
    return;
  }
  el.classList.add("bg-transparent", "hover:border-notion-divider", "hover:bg-notion-sidebar/35");
}

function applyVirtualRowSlotChrome(rowEl: HTMLElement, selected: boolean): void {
  const slot = rowEl.closest(".segment-list-virtual-row-slot") as HTMLElement | null;
  if (!slot) return;
  setCspLayoutRules(
    slot,
    selected ? { overflow: "visible", zIndex: 1 } : { overflow: "hidden", zIndex: null },
  );
}

function applyListRowLook(rowEl: HTMLElement, selected: boolean, inSelection: boolean): void {
  setRowShellClassTokens(rowEl, selected, inSelection);
  applyVirtualRowSlotChrome(rowEl, selected);
}

function indicesToUpdate(prev: ReadonlySet<number>, next: ReadonlySet<number>): number[] {
  const touched = new Set<number>();
  for (const idx of prev) touched.add(idx);
  for (const idx of next) touched.add(idx);
  return [...touched];
}

export function applySelectionChromeImperative(input: {
  overlayRoot: ParentNode | null;
  listRoot: ParentNode | null;
  segments: readonly SegmentDto[];
  prevSnapshot: SelectionChromeSnapshot;
  nextSnapshot: SelectionChromeSnapshot;
}): void {
  const { overlayRoot, listRoot, segments, prevSnapshot, nextSnapshot } = input;
  const prevPrimary = prevSnapshot.primaryIdx;
  const nextPrimary = nextSnapshot.primaryIdx;
  const touched = indicesToUpdate(prevSnapshot.selectedSet, nextSnapshot.selectedSet);

  if (prevPrimary >= 0 && !touched.includes(prevPrimary)) {
    touched.push(prevPrimary);
  }
  if (nextPrimary >= 0 && !touched.includes(nextPrimary)) {
    touched.push(nextPrimary);
  }

  for (const idx of touched) {
    const seg = segments[idx];
    if (!seg) continue;

    const multiSelectActive = nextSnapshot.selectedSet.size > 1;
    const selected = idx === nextPrimary;
    const inSelection = nextSnapshot.selectedSet.has(idx) && !selected;

    if (overlayRoot) {
      const overlayEl = waveformSegmentEl(overlayRoot, idx);
      if (overlayEl) {
        applyWaveformSegmentLook(overlayEl, seg, selected, inSelection, multiSelectActive);
      }
    }

    if (listRoot) {
      const rowEl = listRowEl(listRoot, idx);
      if (rowEl) {
        applyListRowLook(rowEl, selected, inSelection);
      }
    }
  }
}

/** @deprecated Use applySelectionChromeImperative — kept for waveform-only tests. */
export function applyWaveformSegmentSelectionImperative(input: {
  overlayRoot: ParentNode | null;
  segments: readonly SegmentDto[];
  prevSelectedIdx: number;
  nextSelectedIdx: number;
}): void {
  const prevSet =
    input.prevSelectedIdx >= 0 ? new Set([input.prevSelectedIdx]) : new Set<number>();
  const nextSet =
    input.nextSelectedIdx >= 0 ? new Set([input.nextSelectedIdx]) : new Set<number>();
  applySelectionChromeImperative({
    overlayRoot: input.overlayRoot,
    listRoot: null,
    segments: input.segments,
    prevSnapshot: {
      primaryIdx: input.prevSelectedIdx,
      selectedSet: prevSet,
      version: 0,
      fileId: null,
    },
    nextSnapshot: {
      primaryIdx: input.nextSelectedIdx,
      selectedSet: nextSet,
      version: 1,
      fileId: null,
    },
  });
}
