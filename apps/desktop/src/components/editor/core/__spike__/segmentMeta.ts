import { StateEffect, StateField } from "@codemirror/state";

/** Spike-only segment metadata aligned 1:1 with doc lines. */
export type SpikeSegmentMeta = {
  uid: string;
  startSec: number;
  endSec: number;
  stage: string | null;
  speakerId: string | null;
};

export const setSpikeSegmentMetaEffect = StateEffect.define<SpikeSegmentMeta[]>();

export const spikeSegmentMetaField = StateField.define<SpikeSegmentMeta[]>({
  create() {
    return [];
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSpikeSegmentMetaEffect)) return e.value;
    }
    // Spike: structural remap of meta on doc change is validated in later phases.
    // Text edits that do not change line count keep the same meta array.
    if (!tr.docChanged) return value;
    const lineCount = tr.state.doc.lines;
    if (lineCount === value.length) return value;
    // Line count drift — keep prefix and pad/truncate for spike observability.
    if (lineCount < value.length) return value.slice(0, lineCount);
    const pad: SpikeSegmentMeta[] = [];
    for (let i = value.length; i < lineCount; i++) {
      pad.push({
        uid: `spike-pad-${i}`,
        startSec: 0,
        endSec: 0,
        stage: null,
        speakerId: null,
      });
    }
    return value.concat(pad);
  },
});
