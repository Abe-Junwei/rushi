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
import { readTranscriptEditorCoreEnabled } from "../components/editor/core/transcriptEditorCoreFlag";
import { dispatchTranscriptInsertAt } from "../components/editor/core/transcriptEditorViewHandle";
import { persistTranscriptStructureFromView } from "../components/editor/core/persistTranscriptStructureFromView";

function roundSec3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export type SegmentInsertDeps = {
  busy: boolean;
  segmentPublish: SegmentPublishApi;
  setSelectedIdx: (idx: number) => void;
  setError: (msg: string) => void;
  pushUndo: () => void;
  onSelectionCollapsed?: (idx: number) => void;
};

function persistCoreStructure(
  baseline: readonly SegmentDto[],
  deps: Pick<SegmentInsertDeps, "pushUndo" | "segmentPublish" | "setSelectedIdx" | "onSelectionCollapsed">,
): boolean {
  return persistTranscriptStructureFromView(baseline, {
    pushUndo: deps.pushUndo,
    publishStructure: (next) => deps.segmentPublish.publishStructure(next),
    onPrimaryIdx: (idx) => {
      deps.setSelectedIdx(idx);
      deps.onSelectionCollapsed?.(idx);
    },
  });
}

function buildEmptyUserSegment(startSec: number, endSec: number): SegmentDto {
  return newUserCreatedSegment({
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
}

export function createSegmentInsertActions(deps: SegmentInsertDeps) {
  const { busy, segmentPublish, setSelectedIdx, setError, pushUndo, onSelectionCollapsed } = deps;

  function insertSegmentAfter(idx: number, mediaDurationSec = 0) {
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
    const newSeg = buildEmptyUserSegment(startSec, endSec);
    const insertAt = idx + 1;
    if (readTranscriptEditorCoreEnabled()) {
      if (dispatchTranscriptInsertAt(segs, insertAt, newSeg) && persistCoreStructure(segs, deps)) {
        setError("");
        return;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    const base = segmentPublish.getCurrentSegmentsSnapshot();
    if (idx < 0 || idx >= base.length) return;
    setError("");
    pushUndo();
    const out = [...base.slice(0, insertAt), newSeg, ...base.slice(insertAt)];
    segmentPublish.publishStructure(reindexSegments(out));
    setSelectedIdx(insertAt);
    onSelectionCollapsed?.(insertAt);
  }

  function insertSegmentFromTimeRange(
    startSec: number,
    endSec: number,
    mediaDurationSec = 0,
    policy: SegmentOverlapPolicy = "trim",
  ): number | null {
    if (busy) return null;
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
    const insertAt = findSegmentInsertIndexByStart(segs, fitLo);
    const newSeg = buildEmptyUserSegment(fitLo, fitHi);
    if (readTranscriptEditorCoreEnabled()) {
      if (dispatchTranscriptInsertAt(segs, insertAt, newSeg) && persistCoreStructure(segs, deps)) {
        setError("");
        return insertAt;
      }
    }
    segmentPublish.commitTextDraftsForStructureMutation();
    const base = segmentPublish.getCurrentSegmentsSnapshot();
    const insertAtLive = findSegmentInsertIndexByStart(base, fitLo);
    setError("");
    pushUndo();
    const out = [...base.slice(0, insertAtLive), newSeg, ...base.slice(insertAtLive)];
    segmentPublish.publishStructure(reindexSegments(out));
    setSelectedIdx(insertAtLive);
    onSelectionCollapsed?.(insertAtLive);
    return insertAtLive;
  }

  return { insertSegmentAfter, insertSegmentFromTimeRange };
}
