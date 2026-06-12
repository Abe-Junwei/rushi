import { materializeSegmentTextDrafts } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";

/** 将草稿叠到语段副本上，供脏检查使用（不触发 React flushSync / setState）。 */
export function segmentsWithDraftsApplied(segments: SegmentDto[]): SegmentDto[] {
  return materializeSegmentTextDrafts(segments);
}
