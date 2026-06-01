import type { SegmentDto } from "../../tauri/projectApi";
import {
  buildSplitPair,
  findSegmentIndexByUid,
  mergeTwoSegments,
  reindexSegments,
} from "../../pages/segmentListHelpers";
import type { SegmentRefineOp } from "./postprocessSegmentOps";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function applyOneOp(segments: SegmentDto[], op: SegmentRefineOp): SegmentDto[] | null {
  if (op.op === "update_text") {
    const idx = findSegmentIndexByUid(segments, op.uid.trim());
    if (idx < 0) return null;
    const row = segments[idx];
    if (!row) return null;
    const next = [...segments];
    next[idx] = { ...row, text: op.text };
    return next;
  }
  if (op.op === "merge") {
    const indices = op.uids
      .map((uid) => findSegmentIndexByUid(segments, uid.trim()))
      .sort((a, b) => a - b);
    if (indices.length < 2 || indices.some((i) => i < 0)) return null;
    for (let k = 1; k < indices.length; k++) {
      const prev = indices[k - 1];
      const cur = indices[k];
      if (prev === undefined || cur === undefined || cur !== prev + 1) return null;
    }
    const first = indices[0];
    const last = indices[indices.length - 1];
    if (first === undefined || last === undefined) return null;
    const head = segments[first];
    if (!head) return null;
    let merged = head;
    for (let k = 1; k < indices.length; k++) {
      const idx = indices[k];
      if (idx === undefined) return null;
      const part = segments[idx];
      if (!part) return null;
      merged = mergeTwoSegments(merged, part);
    }
    const cur = [...segments.slice(0, first), merged, ...segments.slice(last + 1)];
    return reindexSegments(cur);
  }
  if (op.op === "split") {
    const idx = findSegmentIndexByUid(segments, op.uid.trim());
    if (idx < 0) return null;
    const seg = segments[idx];
    if (!seg) return null;
    const pair = buildSplitPair(seg, roundSec3(op.at_sec));
    if (!pair) return null;
    const left = { ...pair.left, text: op.left_text };
    const right = { ...pair.right, text: op.right_text };
    const cur = [...segments.slice(0, idx), left, right, ...segments.slice(idx + 1)];
    return reindexSegments(cur);
  }
  return null;
}

export function applySegmentRefineOps(
  segments: SegmentDto[],
  ops: SegmentRefineOp[],
): SegmentDto[] | null {
  let cur = segments;
  for (const op of ops) {
    const next = applyOneOp(cur, op);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

export function segmentsMonotonicByTime(segments: SegmentDto[]): boolean {
  for (let i = 1; i < segments.length; i++) {
    const cur = segments[i];
    const prev = segments[i - 1];
    if (!cur || !prev) return false;
    if (cur.start_sec < prev.start_sec) return false;
    if (cur.start_sec < prev.end_sec - 1e-6) return false;
  }
  return true;
}
