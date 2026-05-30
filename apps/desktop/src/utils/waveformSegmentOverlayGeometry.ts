import type { SegmentDto } from "../tauri/projectApi";
import { computeDragSegmentBounds } from "./waveformSegmentBounds";
import type { OverlayDragMode } from "./waveformSegmentOverlayGestures";
import { timeToTimelinePx } from "./waveformProjection";

export type SegmentOverlayDraft = {
  idx: number;
  startSec: number;
  endSec: number;
};

export type CreateRangePreview = {
  startSec: number;
  endSec: number;
};

export type OverlayDragState = {
  mode: OverlayDragMode;
  pointerId: number;
  segmentIdx: number;
  anchorTimeSec: number;
  anchorClientX: number;
  initialStartSec: number;
  initialEndSec: number;
  moved: boolean;
};

/** 语段条渲染边界：拖拽 draft 优先于 committed segment。 */
export function resolveSegmentBoundsAt(
  idx: number,
  segments: SegmentDto[],
  segmentDraft: SegmentOverlayDraft | null,
): { startSec: number; endSec: number } | null {
  const seg = segments[idx];
  if (!seg) return null;
  if (segmentDraft?.idx === idx) {
    return { startSec: segmentDraft.startSec, endSec: segmentDraft.endSec };
  }
  return { startSec: seg.start_sec, endSec: seg.end_sec };
}

/** 框选预览 DOM 几何（timeline 坐标，随 tier 滚动）。 */
export function computeCreatePreviewStyle(input: {
  createPreview: CreateRangePreview;
  timelineWidthPx: number;
  durationSec: number;
}): { left: number; width: number } {
  const lo = Math.min(input.createPreview.startSec, input.createPreview.endSec);
  const hi = Math.max(input.createPreview.startSec, input.createPreview.endSec);
  const leftPx = timeToTimelinePx(lo, input.timelineWidthPx, input.durationSec);
  const rightPx = timeToTimelinePx(hi, input.timelineWidthPx, input.durationSec);
  return {
    left: Math.max(0, leftPx),
    width: Math.max(2, rightPx - leftPx),
  };
}

export function boundsForOverlayDrag(
  drag: OverlayDragState,
  timeSec: number,
  durationSec: number,
): { startSec: number; endSec: number } | null {
  if (drag.mode === "create") return null;
  const delta = timeSec - drag.anchorTimeSec;
  return computeDragSegmentBounds(
    drag.mode,
    drag.initialStartSec,
    drag.initialEndSec,
    delta,
    durationSec || drag.initialEndSec,
  );
}
