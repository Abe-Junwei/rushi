import { flushSync } from "react-dom";
import type { SegmentDto } from "../tauri/projectApi";
import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
} from "../hooks/useSegmentDraftStore";

/** 将草稿 store 中未提交的语段正文写回 `segments`（保存/合并/导出等前调用）。 */
export function flushSegmentTextDrafts(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>,
): void {
  const prev = segmentsRef.current;
  const validKeys = new Set<string>();
  const updates: { idx: number; text: string }[] = [];
  prev.forEach((s, i) => {
    const key = segmentDraftKey(s, i);
    validKeys.add(key);
    if (segmentDraftStore.isComposing(key)) return;
    const draft = segmentDraftStore.getDraft(key);
    if (draft === undefined) return;
    const committed = normalizeSegmentDraftText(s.text ?? "");
    if (draft === committed) return;
    updates.push({ idx: i, text: draft });
  });
  segmentDraftStore.pruneMissingKeys(validKeys);
  if (updates.length === 0) return;
  flushSync(() => {
    setSegments((cur) => {
      let next = cur;
      for (const { idx, text } of updates) {
        if (idx < 0 || idx >= cur.length) continue;
        const seg = cur[idx];
        if (!seg || seg.text === text) continue;
        if (next === cur) next = [...cur];
        next[idx] = { ...seg, text };
      }
      return next;
    });
  });
  for (const { idx, text } of updates) {
    const seg = segmentsRef.current[idx];
    if (!seg) continue;
    const key = segmentDraftKey(seg, idx);
    if (segmentDraftStore.getDraft(key) === text) {
      segmentDraftStore.clearDraft(key);
    }
  }
}
