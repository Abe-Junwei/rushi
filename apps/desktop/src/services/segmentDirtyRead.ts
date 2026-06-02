import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
} from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";

/** 将草稿叠到语段副本上，供脏检查使用（不触发 React flushSync / setState）。 */
export function segmentsWithDraftsApplied(segments: SegmentDto[]): SegmentDto[] {
  return segments.map((s, i) => {
    const draft = segmentDraftStore.getDraft(segmentDraftKey(s, i));
    if (draft === undefined) return s;
    const committed = normalizeSegmentDraftText(s.text ?? "");
    if (draft === committed) return s;
    return { ...s, text: draft };
  });
}
