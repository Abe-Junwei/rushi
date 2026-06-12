import type { SegmentDto } from "../tauri/projectApi";
import { normalizeSegmentDraftText } from "../hooks/useSegmentDraftStore";

/** S1 下 ref 可能领先 React state；同长度同 uid 且 ref 正文更新时保留 ref。 */
export function reconcileSegmentsRefWithState(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  segments: SegmentDto[],
): void {
  if (segmentsRef.current === segments) return;
  const ref = segmentsRef.current;
  if (ref.length === segments.length) {
    let refTextAhead = false;
    for (let i = 0; i < segments.length; i += 1) {
      const r = ref[i];
      const s = segments[i];
      if (!r || !s || r.uid !== s.uid) {
        refTextAhead = false;
        break;
      }
      const rt = normalizeSegmentDraftText(r.text ?? "");
      const st = normalizeSegmentDraftText(s.text ?? "");
      if (rt !== st) {
        refTextAhead = true;
        break;
      }
    }
    if (refTextAhead) return;
  }
  segmentsRef.current = segments;
}
