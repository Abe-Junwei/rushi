import type { SegmentDto } from "../tauri/p1Api";

/** 连续 `idx` 与数组下标一致（SQLite / Tauri 保存前常用）。 */
export function reindexSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((x, j) => ({ ...x, idx: j }));
}

/** 合并两条相邻语段（时间、文本、置信度与 detail）。 */
export function mergeTwoSegments(a: SegmentDto, b: SegmentDto): SegmentDto {
  const confA = a.confidence ?? null;
  const confB = b.confidence ?? null;
  return {
    idx: a.idx,
    start_sec: a.start_sec,
    end_sec: b.end_sec,
    text: `${a.text}\n${b.text}`.trim(),
    confidence:
      confA != null && confB != null ? Math.min(confA, confB) : (confA ?? confB ?? null),
    low_confidence: Boolean(a.low_confidence || b.low_confidence),
    detail: [a.detail, b.detail].filter(Boolean).join(" / ") || null,
  };
}

/** 在 `mid` 处拆分；不满足最小时长则返回 `null`。 */
export function buildSplitPair(s: SegmentDto, mid: number): { left: SegmentDto; right: SegmentDto } | null {
  if (mid <= s.start_sec + 0.02 || mid >= s.end_sec - 0.02) return null;
  const left: SegmentDto = { ...s, end_sec: mid, text: s.text };
  const right: SegmentDto = {
    idx: s.idx + 1,
    start_sec: mid,
    end_sec: s.end_sec,
    text: "",
    confidence: null,
    low_confidence: false,
    detail: null,
  };
  return { left, right };
}
