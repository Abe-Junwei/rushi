import { StateEffect, StateField, type Extension } from "@codemirror/state";

/** True when the primary row is in scoped segment playback (play/stop icon). */
export const setTranscriptScopedPlayingEffect = StateEffect.define<boolean>();

export const transcriptScopedPlayingField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setTranscriptScopedPlayingEffect)) return e.value;
    }
    return value;
  },
});

export const transcriptScopedPlayingExtensions: Extension[] = [transcriptScopedPlayingField];
