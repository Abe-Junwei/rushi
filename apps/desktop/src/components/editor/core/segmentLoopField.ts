import { StateEffect, StateField, type Extension } from "@codemirror/state";

/** True when selected-segment loop playback is armed (list gutter loop chrome). */
export const setTranscriptSegmentLoopEffect = StateEffect.define<boolean>();

export const transcriptSegmentLoopField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTranscriptSegmentLoopEffect)) return e.value;
    }
    return value;
  },
});

export const transcriptSegmentLoopExtensions: Extension[] = [transcriptSegmentLoopField];
