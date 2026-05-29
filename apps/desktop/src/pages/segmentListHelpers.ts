import type { SegmentDto } from "../tauri/projectApi";
import { createSegmentUid, ensureSegmentUids, ensureUniqueSegmentUids } from "../utils/segmentUid";

export { createSegmentUid, ensureSegmentUids, ensureUniqueSegmentUids };

/** 深拷贝语段数组（不重新索引）。 */
export function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

/** 连续 `idx` 与数组下标一致（SQLite / Tauri 保存前常用）。 */
export function reindexSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((x, j) => ({ ...x, idx: j }));
}

export function compareSegmentsByStartSec(
  a: Pick<SegmentDto, "start_sec" | "end_sec">,
  b: Pick<SegmentDto, "start_sec" | "end_sec">,
): number {
  const byStart = a.start_sec - b.start_sec;
  return byStart !== 0 ? byStart : a.end_sec - b.end_sec;
}

export function isSegmentsSortedByStart(segs: Pick<SegmentDto, "start_sec" | "end_sec">[]): boolean {
  for (let i = 1; i < segs.length; i++) {
    if (compareSegmentsByStartSec(segs[i - 1], segs[i]) > 0) return false;
  }
  return true;
}

/** 列表与波形共用时间升序；已排序时仅 reindex。 */
export function sortSegmentsByStartSec(segs: SegmentDto[]): SegmentDto[] {
  if (segs.length < 2) return reindexSegments(segs);
  if (isSegmentsSortedByStart(segs)) return reindexSegments(segs);
  return reindexSegments([...segs].sort(compareSegmentsByStartSec));
}

export function findSegmentIndexByUid(segs: SegmentDto[], uid: string | null | undefined): number {
  if (!uid) return -1;
  return segs.findIndex((s) => s.uid === uid);
}

/** 从后端载入或保存回读后的语段列表规范化（uid、唯一性、时间序、idx）。 */
export function normalizeSegmentList(segs: SegmentDto[]): SegmentDto[] {
  return sortSegmentsByStartSec(ensureUniqueSegmentUids(ensureSegmentUids(cloneSegments(segs))));
}

/** 与 `file_save_segments` 落库字段对齐，用于未保存检测。 */
export function segmentsEqualForPersist(a: SegmentDto[], b: SegmentDto[]): boolean {
  const na = reindexSegments(a);
  const nb = reindexSegments(b);
  if (na.length !== nb.length) return false;
  return na.every((s, i) => {
    const t = nb[i];
    if (!t) return false;
    return (
      (s.uid ?? "") === (t.uid ?? "") &&
      s.start_sec === t.start_sec &&
      s.end_sec === t.end_sec &&
      s.text === t.text &&
      (s.confidence ?? null) === (t.confidence ?? null) &&
      Boolean(s.low_confidence) === Boolean(t.low_confidence) &&
      (s.detail ?? null) === (t.detail ?? null)
    );
  });
}

export function snapshotSegmentsForPersist(segs: SegmentDto[]): SegmentDto[] {
  return cloneSegments(reindexSegments(segs));
}

/** 合并两条相邻语段（时间、文本、置信度与 detail）。 */
export function mergeTwoSegments(a: SegmentDto, b: SegmentDto): SegmentDto {
  const confA = a.confidence ?? null;
  const confB = b.confidence ?? null;
  return {
    uid: a.uid,
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
    uid: createSegmentUid(),
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
