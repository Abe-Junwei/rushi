import { StateEffect, StateField } from "@codemirror/state";
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
    if (lineCount === value.length) return value;
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
