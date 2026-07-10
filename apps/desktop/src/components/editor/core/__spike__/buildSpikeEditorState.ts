import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import type { SegmentDto } from "../../../../tauri/projectTypes";
import {
  encodeNewlinesForSingleLineDoc,
  decodeNewlinesFromSingleLineDoc,
} from "./auditSegmentNewlines";
import {
  setSpikeSegmentMetaEffect,
  spikeSegmentMetaField,
  type SpikeSegmentMeta,
} from "./segmentMeta";
import { spikeSelectionHighlight } from "./selectionHighlight";
import { spikeMetaGutter } from "./metaGutter";

export type SpikeBuildOptions = {
  /** Extra CM6 extensions (theme, keymap, etc.). */
  extensions?: Extension[];
  /** Include meta gutter (default true). */
  withMetaGutter?: boolean;
  /**
   * P0 default strategy: encode embedded `\n` as U+240A so line count == segment count.
   * Set false only to demonstrate naive-join divergence in tests.
   */
  encodeEmbeddedNewlines?: boolean;
};

/**
 * Build a CM6 EditorState: one document line per segment.
 * Default: encode embedded newlines with U+240A (reversible; never silent space replace).
 */
export function buildSpikeEditorState(
  segments: readonly SegmentDto[],
  opts: SpikeBuildOptions = {},
): EditorState {
  const encode = opts.encodeEmbeddedNewlines !== false;
  const texts = segments.map((s) => {
    const raw = s.text ?? "";
    return encode ? encodeNewlinesForSingleLineDoc(raw) : raw;
  });
  const doc = texts.length === 0 ? "" : texts.join("\n");
  const meta: SpikeSegmentMeta[] = segments.map((s, i) => ({
    uid: s.uid ?? `idx-${i}`,
    startSec: s.start_sec,
    endSec: s.end_sec,
    stage: s.text_stage ?? null,
    speakerId: null,
  }));

  const withMetaGutter = opts.withMetaGutter !== false;
  const extensions: Extension[] = [
    spikeSegmentMetaField,
    spikeSelectionHighlight,
    ...(withMetaGutter ? [spikeMetaGutter] : []),
    ...(opts.extensions ?? []),
  ];

  let state = EditorState.create({ doc, extensions });
  state = state.update({
    effects: setSpikeSegmentMetaEffect.of(meta),
  }).state;
  return state;
}

/** Serialize spike state back to SegmentDto[]; decodes U+240A → `\n`. */
export function serializeSpikeEditorState(state: EditorState): SegmentDto[] {
  const meta = state.field(spikeSegmentMetaField);
  const out: SegmentDto[] = [];
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const m = meta[i - 1];
    out.push({
      uid: m?.uid,
      idx: i - 1,
      start_sec: m?.startSec ?? 0,
      end_sec: m?.endSec ?? 0,
      text: decodeNewlinesFromSingleLineDoc(line.text),
      text_stage: (m?.stage as SegmentDto["text_stage"]) ?? null,
    });
  }
  return out;
}
