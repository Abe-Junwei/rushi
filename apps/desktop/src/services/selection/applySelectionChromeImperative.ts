import type { SegmentDto } from "../../tauri/projectApi";
import { setCspLayoutRules } from "../../utils/cspElementLayout";
import { waveformRegionFillColor } from "../../utils/segmentChrome";
import type { SelectionChromeSnapshot } from "./selectionChromeStore";

function waveformSegmentEl(root: ParentNode, idx: number): HTMLElement | null {
  const el = root.querySelector(`[data-segment-idx="${idx}"]`);
  return el instanceof HTMLElement ? el : null;
}

function segmentListRowEl(root: ParentNode, idx: number): HTMLElement | null {
  const el = root.querySelector(`[data-seg-row="${idx}"]`);
  return el instanceof HTMLElement ? el : null;
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

function applyListRowLook(el: HTMLElement, selected: boolean, inSelection: boolean): void {
  el.classList.toggle("seg-row-selected", selected);
  el.classList.toggle("seg-row-in-selection", !selected && inSelection);
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
  if (!overlayRoot && !listRoot) return;

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
      const rowEl = segmentListRowEl(listRoot, idx);
      if (rowEl) {
        applyListRowLook(rowEl, selected, inSelection);
      }
    }
  }
}
