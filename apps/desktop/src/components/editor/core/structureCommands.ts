import { EditorSelection, type EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildSplitPair,
  mergeTwoSegments,
  reindexSegments,
} from "../../../pages/segmentListHelpers";
import { resolveSelectedIdxAfterIndexRemoval } from "../../../utils/segmentSelection";
import {
  computeFilteredSegmentIndices,
  isDefaultSegmentListFilter,
  resolveTranscriptFilterVisibleSet,
} from "../../../services/segmentListFilter";
import { encodeSegmentTextForDocLine } from "./segmentNewlineCodec";
import { serializeTranscriptEditorState } from "./serializeTranscriptEditorState";
import { setSegmentMetaEffect, type SegmentMeta } from "./segmentMetaField";
import {
  setTranscriptMultiSelectionEffect,
} from "./selectionField";
import { transcriptStructureEditAnnotation } from "./transcriptEditorKeymap";
import {
  getTranscriptFilterCriteria,
  setTranscriptFilterCriteriaEffect,
  setTranscriptFilterVisibleEffect,
} from "./filterLineVisibility";
import {
  readSegmentViewportAnchorOffsetPx,
  revealSegmentAfterStructureChange,
} from "./revealSegmentAfterStructure";
import { segmentHasAnnotation } from "../../../utils/segmentAnnotation";

export function segmentDtoToMeta(s: SegmentDto, i: number): SegmentMeta {
  return {
    uid: s.uid ?? `idx-${i}`,
    startSec: s.start_sec,
    endSec: s.end_sec,
    stage: s.text_stage ?? null,
    finalizeVia: s.finalize_via ?? null,
    speakerId: null,
    frozen: Boolean(s.frozen),
    hasAnnotation: segmentHasAnnotation(s),
  };
}

function filterEffectsForStructure(
  state: EditorState,
  nextSegments: readonly SegmentDto[],
): Array<
  | ReturnType<typeof setTranscriptFilterVisibleEffect.of>
  | ReturnType<typeof setTranscriptFilterCriteriaEffect.of>
> {
  const criteria = getTranscriptFilterCriteria(state);
  if (criteria == null || isDefaultSegmentListFilter(criteria)) {
    return [
      setTranscriptFilterCriteriaEffect.of(null),
      setTranscriptFilterVisibleEffect.of(null),
    ];
  }
  const filtered = computeFilteredSegmentIndices(nextSegments as SegmentDto[], criteria);
  const visible = resolveTranscriptFilterVisibleSet(true, filtered, nextSegments.length);
  return [
    setTranscriptFilterCriteriaEffect.of(criteria),
    setTranscriptFilterVisibleEffect.of(visible),
  ];
}

/** Overlay CM6 live texts onto baseline DTOs (same length). */
export function withLiveTextsFromState(
  state: EditorState,
  baseline: readonly SegmentDto[],
): SegmentDto[] {
  const live = serializeTranscriptEditorState(state);
  const n = Math.min(baseline.length, live.length);
  return baseline.map((s, i) =>
    i < n ? { ...s, text: live[i]?.text ?? s.text } : s,
  );
}

function selectionAnchorForSegment(texts: readonly string[], segmentIdx: number): number {
  if (segmentIdx <= 0 || texts.length === 0) return 0;
  const prefix = texts.slice(0, segmentIdx).join("\n");
  return prefix.length + 1;
}

/**
 * Replace the whole transcript doc + meta in one structure transaction.
 */
export function replaceTranscriptSegmentsTransaction(
  state: EditorState,
  nextSegments: readonly SegmentDto[],
  primaryIdx: number,
): TransactionSpec | null {
  if (nextSegments.length === 0) {
    return {
      changes: { from: 0, to: state.doc.length, insert: "" },
      annotations: transcriptStructureEditAnnotation.of(true),
      effects: [
        setSegmentMetaEffect.of([]),
        setTranscriptMultiSelectionEffect.of({
          selectedSet: new Set(),
          rangeAnchor: 0,
        }),
        ...filterEffectsForStructure(state, []),
      ],
      selection: EditorSelection.single(0),
    };
  }

  const texts = nextSegments.map((s) => encodeSegmentTextForDocLine(s.text ?? ""));
  const doc = texts.join("\n");
  const meta = nextSegments.map((s, i) => segmentDtoToMeta(s, i));
  const primary = Math.max(0, Math.min(primaryIdx, nextSegments.length - 1));
  const anchor = selectionAnchorForSegment(texts, primary);

  return {
    changes: { from: 0, to: state.doc.length, insert: doc },
    annotations: transcriptStructureEditAnnotation.of(true),
    effects: [
      setSegmentMetaEffect.of(meta),
      setTranscriptMultiSelectionEffect.of({
        selectedSet: new Set([primary]),
        rangeAnchor: primary,
      }),
      ...filterEffectsForStructure(state, nextSegments),
    ],
    selection: EditorSelection.single(anchor),
    // Merged lines often wrap taller than the viewport. CM `scrollIntoView: true`
    // (and nearest-to-bottom) can jump the scroller to the block end — looks like
    // the segment fled the current viewport. Reveal start deliberately below.
    scrollIntoView: false,
  };
}

export function applyTranscriptSegmentsStructure(
  view: EditorView,
  nextSegments: readonly SegmentDto[],
  primaryIdx: number,
): boolean {
  const tr = replaceTranscriptSegmentsTransaction(view.state, nextSegments, primaryIdx);
  if (!tr) return false;
  const anchorIdx = Math.max(0, Math.min(primaryIdx, Math.max(0, view.state.doc.lines - 1)));
  const priorAnchorOffsetPx = readSegmentViewportAnchorOffsetPx(view, anchorIdx);
  view.dispatch(tr);
  const primary = Math.max(0, Math.min(primaryIdx, Math.max(0, nextSegments.length - 1)));
  if (nextSegments.length > 0) {
    revealSegmentAfterStructureChange(view, primary, { priorAnchorOffsetPx });
  }
  return true;
}

export function splitSegmentAtMidpointCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  idx: number,
): boolean {
  if (idx < 0 || idx >= baseline.length) return false;
  const live = withLiveTextsFromState(view.state, baseline);
  const s = live[idx];
  if (!s) return false;
  const mid = (s.start_sec + s.end_sec) / 2;
  const pair = buildSplitPair(s, mid);
  if (!pair) return false;
  const out = [...live];
  out.splice(idx, 1, pair.left, pair.right);
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), idx + 1);
}

export function splitSegmentAtTimeCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  timeSec: number,
): boolean {
  const t = Math.round(timeSec * 1000) / 1000;
  const live = withLiveTextsFromState(view.state, baseline);
  const idx = live.findIndex((s) => t > s.start_sec + 0.02 && t < s.end_sec - 0.02);
  if (idx < 0) return false;
  const s = live[idx];
  const pair = buildSplitPair(s, t);
  if (!pair) return false;
  const out = [...live];
  out.splice(idx, 1, pair.left, pair.right);
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), idx + 1);
}

export function mergeWithNextCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  idx: number,
): boolean {
  if (idx < 0 || idx >= baseline.length - 1) return false;
  const live = withLiveTextsFromState(view.state, baseline);
  const a = live[idx];
  const b = live[idx + 1];
  if (!a || !b) return false;
  const merged = mergeTwoSegments(a, b);
  const out = [...live];
  out.splice(idx, 2, merged);
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), idx);
}

export function mergeWithPrevCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  idx: number,
): boolean {
  if (idx <= 0 || idx >= baseline.length) return false;
  return mergeWithNextCommand(view, baseline, idx - 1);
}

export function mergeSegmentRangeCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  lo: number,
  hi: number,
): boolean {
  if (lo < 0 || hi >= baseline.length || lo >= hi) return false;
  const live = withLiveTextsFromState(view.state, baseline);
  let merged = live[lo];
  if (!merged) return false;
  for (let i = lo + 1; i <= hi; i++) {
    const seg = live[i];
    if (!seg) continue;
    merged = mergeTwoSegments(merged, seg);
  }
  const out = [...live.slice(0, lo), merged, ...live.slice(hi + 1)];
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), lo);
}

export function deleteSegmentAtCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  idx: number,
): boolean {
  if (idx < 0 || idx >= baseline.length) return false;
  const live = withLiveTextsFromState(view.state, baseline);
  const out = live.filter((_, j) => j !== idx);
  const nextPrimary =
    out.length <= 0 ? 0 : Math.max(0, Math.min(idx, out.length - 1));
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), nextPrimary);
}

export function deleteSegmentRangeCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  lo: number,
  hi: number,
): boolean {
  if (lo < 0 || hi >= baseline.length || lo > hi) return false;
  const live = withLiveTextsFromState(view.state, baseline);
  const out = [...live.slice(0, lo), ...live.slice(hi + 1)];
  const nextPrimary =
    out.length <= 0 ? 0 : Math.max(0, Math.min(lo, out.length - 1));
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), nextPrimary);
}

/** Sparse multi-delete (non-contiguous indices). */
export function deleteSegmentIndicesCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  rawIndices: readonly number[],
  prevPrimaryIdx: number,
): boolean {
  const live = withLiveTextsFromState(view.state, baseline);
  const indices = [...new Set(rawIndices)]
    .filter((idx) => idx >= 0 && idx < live.length)
    .sort((a, b) => a - b);
  if (indices.length === 0) return false;
  if (indices.length === 1) {
    return deleteSegmentAtCommand(view, baseline, indices[0]);
  }
  const lo = indices[0];
  const hi = indices[indices.length - 1];
  const contiguous = indices.length === hi - lo + 1 && indices.every((v, i) => v === lo + i);
  if (contiguous) {
    return deleteSegmentRangeCommand(view, baseline, lo, hi);
  }
  const remove = new Set(indices);
  const out = live.filter((_, j) => !remove.has(j));
  const nextPrimary = resolveSelectedIdxAfterIndexRemoval(live.length, indices, prevPrimaryIdx);
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), nextPrimary);
}

/**
 * Insert a pre-built segment at `insertAt` (0..length). Policy/validation stays in callers.
 */
export function insertSegmentAtCommand(
  view: EditorView,
  baseline: readonly SegmentDto[],
  insertAt: number,
  newSeg: SegmentDto,
): boolean {
  const live = withLiveTextsFromState(view.state, baseline);
  if (insertAt < 0 || insertAt > live.length) return false;
  const out = [...live.slice(0, insertAt), newSeg, ...live.slice(insertAt)];
  return applyTranscriptSegmentsStructure(view, reindexSegments(out), insertAt);
}
