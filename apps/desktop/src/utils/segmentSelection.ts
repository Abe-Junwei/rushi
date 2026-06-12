import type { SegmentDto } from "../tauri/projectTypes";
import { resolveLiveSegmentText } from "../hooks/useSegmentDraftStore";
import { mergeTwoSegments } from "../pages/segmentListHelpers";
import { selectPackableSegmentIndices } from "./waveformSegmentBounds";

export type SegmentSelectionState = {
  anchorIdx: number;
  focusIdx: number;
};

export type SegmentLassoOutcome = {
  indices: Set<number>;
  hitCount: number;
  mode: "select" | "create";
  primaryIdx: number;
};

/** Shift+范围选 anchor：对齐解语 `resolveTranscriptionSelectionAnchor`。 */
export function resolveSegmentSelectionAnchor(
  rangeAnchorIdx: number | null,
  selectedIdx: number,
  fallbackIdx: number,
): number {
  if (rangeAnchorIdx != null && rangeAnchorIdx >= 0) return rangeAnchorIdx;
  if (selectedIdx >= 0) return selectedIdx;
  return fallbackIdx;
}

export function rangeIndices(lo: number, hi: number): Set<number> {
  const out = new Set<number>();
  for (let i = lo; i <= hi; i += 1) out.add(i);
  return out;
}

export function selectionEnvelope(indices: ReadonlySet<number>): { lo: number; hi: number; count: number } | null {
  if (indices.size === 0) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const idx of indices) {
    lo = Math.min(lo, idx);
    hi = Math.max(hi, idx);
  }
  return { lo, hi, count: indices.size };
}

export function isContiguousIndexSelection(indices: ReadonlySet<number>): boolean {
  const env = selectionEnvelope(indices);
  if (!env) return false;
  return env.count === env.hi - env.lo + 1;
}

/** 解语 `toggleSegmentSelection` B1：空集时先 seed 当前 primary。 */
export function toggleSegmentIndex(
  indices: ReadonlySet<number>,
  primaryIdx: number,
  targetIdx: number,
): { indices: Set<number>; primaryIdx: number } | null {
  const next = new Set(indices);
  if (next.size === 0 && primaryIdx >= 0) next.add(primaryIdx);
  if (next.has(targetIdx)) {
    next.delete(targetIdx);
    if (next.size === 0) return null;
    const primary = primaryIdx === targetIdx ? Math.min(...next) : primaryIdx;
    return { indices: next, primaryIdx: primary };
  }
  next.add(targetIdx);
  return { indices: next, primaryIdx: targetIdx };
}

/**
 * 波形空白 lasso：与解语 `computeLassoOutcome` 同构（index 版）。
 * 重叠规则：segEnd > loT && segStart < hiT
 */
export function computeSegmentLassoOutcome(
  segments: SegmentDto[],
  t0: number,
  t1: number,
  durationSec: number,
  baseIndices: ReadonlySet<number>,
): SegmentLassoOutcome {
  const loT = Math.min(t0, t1);
  const hiT = Math.max(t0, t1);
  const { packableIndices } = selectPackableSegmentIndices(segments, durationSec);
  const indices = new Set(baseIndices);
  const hits: number[] = [];
  for (const idx of packableIndices) {
    const seg = segments[idx];
    if (!seg) continue;
    const segLo = Math.min(seg.start_sec, seg.end_sec);
    const segHi = Math.max(seg.start_sec, seg.end_sec);
    if (segHi <= loT || segLo >= hiT) continue;
    indices.add(idx);
    hits.push(idx);
  }
  const hitCount = hits.length;
  const mode: SegmentLassoOutcome["mode"] = hitCount > 0 ? "select" : "create";
  let primaryIdx = -1;
  if (hitCount > 0) {
    const firstNewHit = hits.find((idx) => !baseIndices.has(idx));
    primaryIdx = firstNewHit ?? hits[0] ?? -1;
  }
  return { indices, hitCount, mode, primaryIdx };
}

export function clampSegmentIndex(idx: number, segmentCount: number): number {
  if (segmentCount <= 0) return 0;
  return Math.max(0, Math.min(idx, segmentCount - 1));
}

export function normalizeSegmentIndexRange(
  anchor: number,
  focus: number,
  segmentCount: number,
): { lo: number; hi: number } | null {
  if (segmentCount <= 0) return null;
  const lo = clampSegmentIndex(Math.min(anchor, focus), segmentCount);
  const hi = clampSegmentIndex(Math.max(anchor, focus), segmentCount);
  return { lo, hi };
}

export function resolveSegmentSelectionRange(
  selection: SegmentSelectionState | null,
  selectedIdx: number,
  segmentCount: number,
): { lo: number; hi: number; count: number } | null {
  if (segmentCount <= 0) return null;
  if (selection) {
    const range = normalizeSegmentIndexRange(selection.anchorIdx, selection.focusIdx, segmentCount);
    if (!range) return null;
    return { ...range, count: range.hi - range.lo + 1 };
  }
  const idx = clampSegmentIndex(selectedIdx, segmentCount);
  return { lo: idx, hi: idx, count: 1 };
}

export function selectionRangeFromTimeMarquee(
  segments: SegmentDto[],
  t0: number,
  t1: number,
  durationSec: number,
): { lo: number; hi: number } | null {
  const loT = Math.min(t0, t1);
  const hiT = Math.max(t0, t1);
  const { packableIndices } = selectPackableSegmentIndices(segments, durationSec);
  let lo = -1;
  let hi = -1;
  for (const idx of packableIndices) {
    const seg = segments[idx];
    if (!seg) continue;
    const segLo = Math.min(seg.start_sec, seg.end_sec);
    const segHi = Math.max(seg.start_sec, seg.end_sec);
    if (segHi <= loT || segLo >= hiT) continue;
    if (lo < 0 || idx < lo) lo = idx;
    if (hi < 0 || idx > hi) hi = idx;
  }
  if (lo < 0 || hi < 0) return null;
  return { lo, hi };
}

export function mergeSegmentRangeFold(
  segments: SegmentDto[],
  lo: number,
  hi: number,
): SegmentDto {
  const first = segments[lo];
  if (first === undefined) {
    throw new Error("mergeSegmentRangeFold: empty range");
  }
  let merged: SegmentDto = { ...first, text: resolveLiveSegmentText(first, lo) };
  for (let i = lo + 1; i <= hi; i += 1) {
    const seg = segments[i];
    if (seg === undefined) continue;
    merged = mergeTwoSegments(merged, { ...seg, text: resolveLiveSegmentText(seg, i) });
  }
  return merged;
}

/** 稀疏删除后映射 primary 到新 index（供 mutation 与单测共用）。 */
export function resolveSelectedIdxAfterIndexRemoval(
  segmentCount: number,
  removedIndices: readonly number[],
  prevSelected: number,
): number {
  const remove = new Set(removedIndices);
  const keptOld = Array.from({ length: segmentCount }, (_, i) => i).filter((i) => !remove.has(i));
  if (keptOld.length === 0) return 0;
  if (remove.has(prevSelected)) {
    const pos = keptOld.findIndex((i) => i >= prevSelected);
    return pos >= 0 ? pos : keptOld.length - 1;
  }
  const pos = keptOld.indexOf(prevSelected);
  return pos >= 0 ? pos : keptOld.length - 1;
}
