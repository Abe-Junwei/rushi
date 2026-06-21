import type { SegmentDto } from "../tauri/projectApi";
import { createSegmentUid } from "../utils/segmentUid";
import { reindexSegments } from "./segmentListHelpers";
import { newUserCreatedSegment } from "../services/segmentTextStage";
import {
  describeCreateRangePolicyFailure,
  resolveCreateRangeForPolicy,
  type SegmentOverlapPolicy,
} from "../utils/segmentTimeRange";
import {
  findSegmentInsertIndexByStart,
  resolveInsertAfterSpan,
} from "../utils/segmentGapPolicy";
import {
  clampSegmentTimeBounds,
  selectPackableSegments,
  WAVEFORM_SEGMENT_MIN_SPAN_SEC,
} from "../utils/waveformSegmentBounds";
import type { SegmentPublishApi } from "./segmentPublishApi";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export type SegmentInsertDeps = {
  busy: boolean;
  segmentPublish: SegmentPublishApi;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  setError: (msg: string) => void;
  pushUndo: () => void;
  onSelectionCollapsed?: (idx: number) => void;
};

export function createSegmentInsertActions(deps: SegmentInsertDeps) {
  const { busy, segmentPublish, setSelectedIdx, setError, pushUndo, onSelectionCollapsed } = deps;

  function insertSegmentAfter(idx: number, mediaDurationSec = 0) {
    segmentPublish.commitTextDraftsForStructureMutation();
    const segs = segmentPublish.getCurrentSegmentsSnapshot();
    if (idx < 0 || idx >= segs.length) return;
    const a = segs[idx];
    const b = segs[idx + 1];
    if (!a) return;
    const span = resolveInsertAfterSpan({
      prevEndSec: a.end_sec,
      nextStartSec: b?.start_sec,
      mediaDurationSec: mediaDurationSec > 0 ? mediaDurationSec : undefined,
    });
    if (!span.ok) {
      setError(
        span.reason === "gap-too-small"
          ? "与下一条无足够间隙：请在波形区拖动语段边界留出空档后再插入。"
          : "无法插入：时间范围无效。",
      );
      return;
    }
    const { startSec, endSec } = span;
    setError("");
    pushUndo();
    const newSeg: SegmentDto = newUserCreatedSegment({
      uid: createSegmentUid(),
      idx: 0,
      start_sec: startSec,
      end_sec: endSec,
      text: "",
      confidence: null,
      low_confidence: false,
      detail: null,
      kind: "speech",
    });
    const out = [...segs.slice(0, idx + 1), newSeg, ...segs.slice(idx + 1)];
    segmentPublish.publishStructure(reindexSegments(out));
    const nextIdx = idx + 1;
    setSelectedIdx(nextIdx);
    onSelectionCollapsed?.(nextIdx);
  }

  function insertSegmentFromTimeRange(
    startSec: number,
    endSec: number,
    mediaDurationSec = 0,
    policy: SegmentOverlapPolicy = "trim",
  ): number | null {
    if (busy) return null;
    segmentPublish.commitTextDraftsForStructureMutation();
    let lo = roundSec3(Math.min(startSec, endSec));
    let hi = roundSec3(Math.max(startSec, endSec));
    if (mediaDurationSec > 0) {
      ({ startSec: lo, endSec: hi } = clampSegmentTimeBounds(lo, hi, mediaDurationSec));
    }
    if (hi - lo < WAVEFORM_SEGMENT_MIN_SPAN_SEC) {
      setError(mediaDurationSec > 0 && hi <= lo ? "选区超出媒体时长。" : "选区过短。");
      return null;
    }
    const segs = segmentPublish.getCurrentSegmentsSnapshot();
    const overlapSegs = selectPackableSegments(segs, mediaDurationSec);
    const clamped = resolveCreateRangeForPolicy(overlapSegs, lo, hi, policy);
    if (!clamped) {
      setError(describeCreateRangePolicyFailure(policy, lo, hi, overlapSegs));
      return null;
    }
    let { startSec: fitLo, endSec: fitHi } = clamped;
    if (mediaDurationSec > 0) {
      ({ startSec: fitLo, endSec: fitHi } = clampSegmentTimeBounds(fitLo, fitHi, mediaDurationSec));
      if (fitHi - fitLo < WAVEFORM_SEGMENT_MIN_SPAN_SEC) {
        setError("选区超出媒体时长。");
        return null;
      }
    }
    setError("");
    pushUndo();
    const insertAt = findSegmentInsertIndexByStart(segs, fitLo);
    const newSeg: SegmentDto = newUserCreatedSegment({
      uid: createSegmentUid(),
      idx: 0,
      start_sec: fitLo,
      end_sec: fitHi,
      text: "",
      confidence: null,
      low_confidence: false,
      detail: null,
      kind: "speech",
    });
    const out = [...segs.slice(0, insertAt), newSeg, ...segs.slice(insertAt)];
    segmentPublish.publishStructure(reindexSegments(out));
    setSelectedIdx(insertAt);
    onSelectionCollapsed?.(insertAt);
    return insertAt;
  }

  return { insertSegmentAfter, insertSegmentFromTimeRange };
}
