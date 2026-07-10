import type { EditorState } from "@codemirror/state";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { decodeDocLineToSegmentText } from "./segmentNewlineCodec";
import { segmentMetaField } from "./segmentMetaField";

/**
 * CM6 state → SegmentDto[] serialization projection (save/import/export boundary).
 * Not a second writable source of truth.
 *
 * Only fields CM6 owns (uid/idx/times/text/text_stage). Callers that persist must
 * merge into the existing SegmentDto (e.g. via updateSegmentText) so kind /
 * confidence / annotation / detail are not dropped. Do not replace the store
 * array with this projection alone.
 */
export function serializeTranscriptEditorState(state: EditorState): SegmentDto[] {
  const meta = state.field(segmentMetaField);
  const out: SegmentDto[] = [];
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const m = meta[i - 1];
    out.push({
      uid: m?.uid,
      idx: i - 1,
      start_sec: m?.startSec ?? 0,
      end_sec: m?.endSec ?? 0,
      text: decodeDocLineToSegmentText(line.text),
      text_stage: m?.stage ?? null,
      finalize_via: m?.finalizeVia ?? null,
    });
  }
  return out;
}
