import { EditorSelection, EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { encodeSegmentTextForDocLine } from "./segmentNewlineCodec";
import {
  segmentMetaField,
  setSegmentMetaEffect,
  type SegmentMeta,
} from "./segmentMetaField";
import {
  setTranscriptMultiSelectionEffect,
  transcriptMultiSelectionField,
} from "./selectionField";

export type BuildTranscriptEditorStateOptions = {
  extensions?: Extension[];
  /** Default true — reversible U+240A encoding for embedded newlines. */
  encodeEmbeddedNewlines?: boolean;
  /** Seed multi-selection primary (file open / remount). Defaults to 0. */
  initialPrimaryIdx?: number;
};

/**
 * SegmentDto[] → CM6 EditorState (one line per segment).
 * Session write path starts here; SegmentDto[] is only a boundary format.
 */
export function buildTranscriptEditorState(
  segments: readonly SegmentDto[],
  opts: BuildTranscriptEditorStateOptions = {},
): EditorState {
  const encode = opts.encodeEmbeddedNewlines !== false;
  const texts = segments.map((s) => {
    const raw = s.text ?? "";
    return encode ? encodeSegmentTextForDocLine(raw) : raw;
  });
  const doc = texts.length === 0 ? "" : texts.join("\n");
  const meta: SegmentMeta[] = segments.map((s, i) => ({
    uid: s.uid ?? `idx-${i}`,
    startSec: s.start_sec,
    endSec: s.end_sec,
    stage: s.text_stage ?? null,
    finalizeVia: s.finalize_via ?? null,
    speakerId: null,
  }));

  // multi-selection field must precede decorations that read it.
  let state = EditorState.create({
    doc,
    extensions: [segmentMetaField, transcriptMultiSelectionField, ...(opts.extensions ?? [])],
  });
  const lineCount = state.doc.lines;
  const seedIdx =
    lineCount > 0
      ? Math.max(0, Math.min(opts.initialPrimaryIdx ?? 0, lineCount - 1))
      : -1;
  state = state.update({
    selection:
      seedIdx >= 0 ? EditorSelection.single(state.doc.line(seedIdx + 1).from) : undefined,
    effects: [
      setSegmentMetaEffect.of(meta),
      ...(seedIdx >= 0
        ? [
            setTranscriptMultiSelectionEffect.of({
              selectedSet: new Set([seedIdx]),
              rangeAnchor: seedIdx,
            }),
          ]
        : []),
    ],
  }).state;
  return state;
}
