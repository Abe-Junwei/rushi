import { StateEffect, StateField } from "@codemirror/state";
import type { Transaction } from "@codemirror/state";
import type { SegmentFinalizeVia, SegmentTextStage } from "../../../tauri/projectTypes";

/** Session-authoritative segment metadata; 1:1 with doc lines. */
export type SegmentMeta = {
  uid: string;
  startSec: number;
  endSec: number;
  stage: SegmentTextStage | null;
  finalizeVia: SegmentFinalizeVia | null;
  /** Reserved for diarization; product UI has no speaker field yet. */
  speakerId: string | null;
  rowHeight?: number | null;
};

export const setSegmentMetaEffect = StateEffect.define<SegmentMeta[]>();

function changedLineIdxsForTextTransaction(tr: Transaction): number[] {
  const out = new Set<number>();
  tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    const fromLine = tr.state.doc.lineAt(fromB).number;
    const toLine = tr.state.doc.lineAt(Math.max(fromB, toB - 1)).number;
    for (let lineNo = fromLine; lineNo <= toLine; lineNo++) {
      out.add(lineNo - 1);
    }
  });
  return [...out].filter((idx) => idx >= 0 && idx < tr.state.doc.lines);
}

function markChangedTextLinesManual(value: readonly SegmentMeta[], tr: Transaction): SegmentMeta[] {
  const changedLineIdxs = changedLineIdxsForTextTransaction(tr);
  if (changedLineIdxs.length === 0) return value as SegmentMeta[];
  // Scan changed lines first; skip full-array allocation when all are already manual.
  const needsChange = changedLineIdxs.some((idx) => {
    const m = value[idx];
    return m != null && !(m.stage === "manual_transcribe" && m.finalizeVia == null);
  });
  if (!needsChange) return value as SegmentMeta[];
  const changedLineIdxSet = new Set(changedLineIdxs);
  return value.map((m, idx) => {
    if (!changedLineIdxSet.has(idx)) return m;
    if (m.stage === "manual_transcribe" && m.finalizeVia == null) return m;
    return { ...m, stage: "manual_transcribe" as const, finalizeVia: null };
  });
}

/**
 * Segment meta StateField. Text edits that keep line count preserve meta.
 * Line-count drift pads/truncates for observability; structure commands (P6)
 * must dispatch explicit setSegmentMetaEffect.
 */
export const segmentMetaField = StateField.define<SegmentMeta[]>({
  create() {
    return [];
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSegmentMetaEffect)) return e.value;
    }
    if (!tr.docChanged) return value;
    const lineCount = tr.state.doc.lines;
    if (lineCount === value.length) return markChangedTextLinesManual(value, tr);
    if (lineCount < value.length) return value.slice(0, lineCount);
    const pad: SegmentMeta[] = [];
    for (let i = value.length; i < lineCount; i++) {
      pad.push({
        uid: `pad-${i}`,
        startSec: 0,
        endSec: 0,
        stage: null,
        finalizeVia: null,
        speakerId: null,
      });
    }
    return value.concat(pad);
  },
});
