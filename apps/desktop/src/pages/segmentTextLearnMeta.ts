import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";

export type SegmentTextLearnMeta = {
  committedText: string;
  liveTextBeforeEdit: string;
  liveAnchor: number;
  removed: string;
  inserted: string;
};

export type SegmentTextUpdateMeta = {
  /** 程序改字可附带的 learn op；标点/整段后处理等入口应省略。 */
  learn?: SegmentTextLearnMeta;
};

export function applySegmentTextLearnMeta(
  seg: SegmentDto,
  idx: number,
  meta: SegmentTextLearnMeta,
): void {
  const key = segmentDraftKey(seg, idx);
  segmentDraftStore.recordProgrammaticLearnReplacement(
    key,
    meta.committedText,
    meta.liveTextBeforeEdit,
    meta.liveAnchor,
    meta.removed,
    meta.inserted,
  );
}

/** 语段正文写回统一入口：有 learn 则经 updateSegmentText 记 op，无则仅改字（如自动标点）。 */
export function applySegmentTextChange(
  _seg: SegmentDto,
  idx: number,
  nextText: string,
  updateSegmentText: (idx: number, text: string, meta?: SegmentTextUpdateMeta) => void,
  meta?: SegmentTextUpdateMeta,
): void {
  updateSegmentText(idx, nextText, meta);
}
