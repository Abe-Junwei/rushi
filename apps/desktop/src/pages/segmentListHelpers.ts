import type { SegmentDto } from "../tauri/projectApi";
import { createSegmentUid, ensureSegmentUids, ensureUniqueSegmentUids } from "../utils/segmentUid";
import { sanitizeSegmentsForMedia } from "../utils/segmentMediaSanitize";
import { trimAdjacentSegmentOverlaps } from "../utils/segmentBoundaryTrim";

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

/** 补全 ASR 语段缺省的显式 kind（手建语段已有 kind:"speech"）。 */
export function ensureExplicitSegmentKinds(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => {
    if (s.kind === "placeholder" || s.kind === "speech") return s;
    if (s.detail === "funasr_whole_track_fallback") return { ...s, kind: "placeholder" };
    return { ...s, kind: "speech" };
  });
}

/** 从后端载入或保存回读后的语段列表规范化（uid、唯一性、时间序、idx、ASR kind、边界重叠修剪）。 */
export function normalizeSegmentList(segs: SegmentDto[]): SegmentDto[] {
  return trimAdjacentSegmentOverlaps(
    sortSegmentsByStartSec(
      ensureUniqueSegmentUids(ensureSegmentUids(cloneSegments(ensureExplicitSegmentKinds(segs)))),
    ),
  );
}

/** 保存前规范化：clamp 到媒体时长，并在有多条分句时移除整轨占位语段。 */
export function prepareSegmentsForPersist(
  segs: SegmentDto[],
  mediaDurationSec = 0,
): SegmentDto[] {
  const { segments } = sanitizeSegmentsForMedia(segs, mediaDurationSec, true);
  return trimAdjacentSegmentOverlaps(
    sortSegmentsByStartSec(ensureUniqueSegmentUids(ensureSegmentUids(cloneSegments(segments)))),
  );
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
      (s.detail ?? null) === (t.detail ?? null) &&
      (s.kind ?? null) === (t.kind ?? null)
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
    // 合并后为用户语段，显式 speech，避免合并出的长段被 0.85 启发式误判为占位。
    kind: "speech",
  };
}

/** 在 `mid` 处拆分；不满足最小时长则返回 `null`。 */
export function buildSplitPair(s: SegmentDto, mid: number): { left: SegmentDto; right: SegmentDto } | null {
  if (mid <= s.start_sec + 0.02 || mid >= s.end_sec - 0.02) return null;
  // 拆分产物均为真实子句，显式 speech（即便拆的是占位整段，拆后两半也是 speech）。
  const left: SegmentDto = { ...s, end_sec: mid, text: s.text, kind: "speech" };
  const right: SegmentDto = {
    uid: createSegmentUid(),
    idx: s.idx + 1,
    start_sec: mid,
    end_sec: s.end_sec,
    text: "",
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  };
  return { left, right };
}
