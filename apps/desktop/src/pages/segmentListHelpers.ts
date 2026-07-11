import type { SegmentDto } from "../tauri/projectApi";
import {
  inheritSplitLeftStage,
  mergeSegmentStageFields,
} from "../services/segmentStagePersist";
import { withDefaultSegmentStage, newSegmentWithDefaultStage } from "../services/segmentTextStage";
import { joinMergedSegmentTexts } from "../utils/joinMergedSegmentTexts";
import { mergeSegmentAnnotations } from "../utils/segmentAnnotation";
import { createSegmentUid, ensureSegmentUids, ensureUniqueSegmentUids } from "../utils/segmentUid";
import { sanitizeSegmentsForMedia } from "../utils/segmentMediaSanitize";
import { trimAdjacentSegmentOverlaps } from "../utils/segmentBoundaryTrim";

export { joinMergedSegmentTexts } from "../utils/joinMergedSegmentTexts";

/** 深拷贝语段数组（不重新索引）。 */
function cloneSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((s) => ({ ...s }));
}

/** 连续 `idx` 与数组下标一致（SQLite / Tauri 保存前常用）。 */
export function reindexSegments(segs: SegmentDto[]): SegmentDto[] {
  return segs.map((x, j) => ({ ...x, idx: j }));
}

function compareSegmentsByStartSec(
  a: Pick<SegmentDto, "start_sec" | "end_sec">,
  b: Pick<SegmentDto, "start_sec" | "end_sec">,
): number {
  const byStart = a.start_sec - b.start_sec;
  return byStart !== 0 ? byStart : a.end_sec - b.end_sec;
}

function isSegmentsSortedByStart(segs: Pick<SegmentDto, "start_sec" | "end_sec">[]): boolean {
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
function ensureExplicitSegmentKinds(segs: SegmentDto[]): SegmentDto[] {
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
      ensureUniqueSegmentUids(
        ensureSegmentUids(cloneSegments(ensureExplicitSegmentKinds(segs))).map((s) =>
          withDefaultSegmentStage(s),
        ),
      ),
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
      (s.kind ?? null) === (t.kind ?? null) &&
      (s.text_stage ?? "auto_transcribe") === (t.text_stage ?? "auto_transcribe") &&
      (s.finalize_via ?? null) === (t.finalize_via ?? null) &&
      (s.annotation ?? null) === (t.annotation ?? null)
    );
  });
}

export function snapshotSegmentsForPersist(segs: SegmentDto[]): SegmentDto[] {
  return cloneSegments(reindexSegments(segs));
}

/** Cheap fingerprint for dirty-check fast path (same fields as segmentsEqualForPersist). */
export function segmentsPersistSignature(segs: SegmentDto[]): string {
  return reindexSegments(segs)
    .map(
      (s) =>
        `${s.uid ?? ""}|${s.start_sec}|${s.end_sec}|${s.text}|${s.confidence ?? ""}|${Boolean(s.low_confidence)}|${s.detail ?? ""}|${s.kind ?? ""}|${s.text_stage ?? "auto_transcribe"}|${s.finalize_via ?? ""}|${s.annotation ?? ""}`,
    )
    .join("\n");
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
    text: joinMergedSegmentTexts(a.text ?? "", b.text ?? ""),
    confidence:
      confA != null && confB != null ? Math.min(confA, confB) : (confA ?? confB ?? null),
    low_confidence: Boolean(a.low_confidence || b.low_confidence),
    detail: [a.detail, b.detail].filter(Boolean).join(" / ") || null,
    kind: "speech",
    annotation: mergeSegmentAnnotations(a, b),
    ...mergeSegmentStageFields(a, b),
  };
}

/** 按时间比例切分正文（playhead / 中点拆分）。 */
export function splitSegmentTextByTimeRatio(
  text: string,
  mid: number,
  startSec: number,
  endSec: number,
): { left: string; right: string } {
  const full = text ?? "";
  const span = endSec - startSec;
  if (full.length === 0) return { left: "", right: "" };
  if (span <= 0) return { left: full, right: "" };
  const ratio = Math.min(1, Math.max(0, (mid - startSec) / span));
  const splitAt = Math.round(full.length * ratio);
  if (splitAt <= 0) return { left: "", right: full };
  if (splitAt >= full.length) return { left: full, right: "" };
  return { left: full.slice(0, splitAt), right: full.slice(splitAt) };
}

/** 在 `mid` 处拆分；不满足最小时长则返回 `null`。 */
export function buildSplitPair(s: SegmentDto, mid: number): { left: SegmentDto; right: SegmentDto } | null {
  if (mid <= s.start_sec + 0.02 || mid >= s.end_sec - 0.02) return null;
  const { left: leftText, right: rightText } = splitSegmentTextByTimeRatio(
    s.text ?? "",
    mid,
    s.start_sec,
    s.end_sec,
  );
  // 拆分产物均为真实子句，显式 speech（即便拆的是占位整段，拆后两半也是 speech）。
  const left: SegmentDto = {
    ...s,
    end_sec: mid,
    text: leftText,
    kind: "speech",
    ...inheritSplitLeftStage(s),
  };
  const right: SegmentDto = newSegmentWithDefaultStage({
    uid: createSegmentUid(),
    idx: s.idx + 1,
    start_sec: mid,
    end_sec: s.end_sec,
    text: rightText,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
    annotation: null,
  });
  return { left, right };
}
