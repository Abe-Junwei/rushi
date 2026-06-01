import type { SegmentDto } from "../../tauri/projectApi";

export type SegmentRefineOp =
  | { op: "update_text"; uid: string; text: string }
  | { op: "merge"; uids: string[] }
  | { op: "split"; uid: string; at_sec: number; left_text: string; right_text: string };

/** Payload for Tauri `postprocess_refine_segments` (camelCase per Rust serde). */
export type RefineSegmentItem = {
  uid: string;
  startSec: number;
  endSec: number;
  text: string;
};

const MIN_SPLIT_SIDE_SEC = 0.02;

export function segmentDtoToRefineItem(seg: SegmentDto): RefineSegmentItem | null {
  const uid = (seg.uid ?? "").trim();
  const text = (seg.text ?? "").trim();
  if (!uid || !text) return null;
  return {
    uid,
    startSec: seg.start_sec,
    endSec: seg.end_sec,
    text: seg.text,
  };
}

/** Selected + adjacent neighbors (max 3) with uid + non-empty text on selection. */
export function collectRefineSegmentWindow(
  segments: SegmentDto[],
  selectedIdx: number,
): RefineSegmentItem[] {
  if (selectedIdx < 0 || selectedIdx >= segments.length) return [];
  const lo = Math.max(0, selectedIdx - 1);
  const hi = Math.min(segments.length - 1, selectedIdx + 1);
  const out: RefineSegmentItem[] = [];
  for (let i = lo; i <= hi; i++) {
    const row = segments[i];
    if (!row) continue;
    const item = segmentDtoToRefineItem(row);
    if (item) out.push(item);
  }
  return out;
}

export function validateRefineOps(segments: RefineSegmentItem[], ops: SegmentRefineOp[]): string | null {
  if (segments.length === 0) return "缺少语段输入。";
  const byUid = new Map<string, RefineSegmentItem>();
  const order: string[] = [];
  for (const s of segments) {
    const uid = s.uid.trim();
    if (!uid) return "语段 uid 为空。";
    if (s.endSec <= s.startSec) return `语段 ${uid} 时间范围无效。`;
    if (byUid.has(uid)) return `重复 uid：${uid}`;
    byUid.set(uid, s);
    order.push(uid);
  }
  order.sort((a, b) => (byUid.get(a)?.startSec ?? 0) - (byUid.get(b)?.startSec ?? 0));

  for (const op of ops) {
    if (op.op === "update_text") {
      const uid = op.uid.trim();
      if (!op.text.trim()) return `update_text(${uid}) 正文为空。`;
      if (!byUid.has(uid)) return `update_text 引用了未知 uid：${uid}`;
    } else if (op.op === "merge") {
      if (op.uids.length < 2) return "merge 至少需要 2 个 uid。";
      const indices: number[] = [];
      for (const raw of op.uids) {
        const uid = raw.trim();
        const idx = order.indexOf(uid);
        if (idx < 0) return `merge 引用了未知 uid：${uid}`;
        indices.push(idx);
      }
      indices.sort((a, b) => a - b);
      for (let i = 1; i < indices.length; i++) {
        const prev = indices[i - 1];
        const cur = indices[i];
        if (prev === undefined || cur === undefined || cur !== prev + 1) {
          return "merge 的 uid 必须在输入中时间相邻。";
        }
      }
    } else if (op.op === "split") {
      const uid = op.uid.trim();
      const seg = byUid.get(uid);
      if (!seg) return `split 引用了未知 uid：${uid}`;
      if (!op.left_text.trim() || !op.right_text.trim()) return `split(${uid}) 两侧正文不能为空。`;
      const at = op.at_sec;
      if (at <= seg.startSec + MIN_SPLIT_SIDE_SEC || at >= seg.endSec - MIN_SPLIT_SIDE_SEC) {
        return `split(${uid}) 的拆分点无效。`;
      }
    }
  }
  return null;
}

function snippetText(text: string, maxChars = 36): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "（空）";
  return t.length <= maxChars ? t : `${t.slice(0, maxChars)}…`;
}

function segmentPreviewLabel(byUid: Map<string, RefineSegmentItem>, uid: string): string {
  const s = byUid.get(uid.trim());
  if (!s) return uid.length > 12 ? `${uid.slice(0, 8)}…` : uid;
  return `[${s.startSec.toFixed(1)}–${s.endSec.toFixed(1)}s] ${snippetText(s.text)}`;
}

/** Human-readable op lines for preview UI (not raw uids). */
export function describeRefineOpsForPreview(
  window: RefineSegmentItem[],
  ops: SegmentRefineOp[],
): string[] {
  const byUid = new Map(window.map((s) => [s.uid.trim(), s]));
  return ops.map((op) => {
    if (op.op === "update_text") {
      return `改字 · ${segmentPreviewLabel(byUid, op.uid)} → ${snippetText(op.text, 48)}`;
    }
    if (op.op === "merge") {
      const parts = op.uids.map((u) => segmentPreviewLabel(byUid, u));
      return `合并 ${parts.length} 条 · ${parts.join(" + ")}`;
    }
    const base = segmentPreviewLabel(byUid, op.uid);
    return `拆分 · ${base} @ ${op.at_sec.toFixed(1)}s → 「${snippetText(op.left_text, 20)}」|「${snippetText(op.right_text, 20)}」`;
  });
}

/** @deprecated Use describeRefineOpsForPreview; kept for tests that only need op kind. */
export function describeRefineOps(ops: SegmentRefineOp[]): string[] {
  return ops.map((op) => {
    if (op.op === "update_text") return `改字 · ${op.uid}`;
    if (op.op === "merge") return `合并 · ${op.uids.join(" + ")}`;
    return `拆分 · ${op.uid} @ ${op.at_sec.toFixed(2)}s`;
  });
}
