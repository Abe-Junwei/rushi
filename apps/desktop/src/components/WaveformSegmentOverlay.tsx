import { memo, useMemo } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";
import { useWaveformSegmentOverlay } from "../hooks/useWaveformSegmentOverlay";
import { computeCreatePreviewStyle } from "../utils/waveformSegmentOverlayGeometry";
import { selectOverlayRenderedSegmentIndices } from "../utils/waveformSegmentOverlayVisibility";
import { waveformRegionFillColor } from "../utils/segmentChrome";

export type WaveformSegmentOverlayProps = {
  disabled: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  timelineWidthPx: number;
  durationSec: number;
  playheadSec?: number;
  layoutHeightPx: number;
  laneByIndex: number[];
  laneCount: number;
  dominantSpanIndices?: number[];
  enableCreateRange: boolean;
  clientXToTimeSec: (clientX: number) => number;
  onSelectSegmentAt: (idx: number) => void;
  onBeginBoundsEdit?: () => void;
  onFocusWaveformShell?: () => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: SegmentOverlapPolicy },
  ) => void;
  onPlaySegment?: (idx: number) => void;
  seekToTime: (timeSec: number) => void;
};

export const WaveformSegmentOverlay = memo(function WaveformSegmentOverlay(props: WaveformSegmentOverlayProps) {
  const {
    createPreview,
    segmentBoundsAt,
    onShellPointerDown,
    onSegmentPointerDown,
    onSegmentClick,
    onSegmentDoubleClick,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    segmentOverlayGeometry,
  } = useWaveformSegmentOverlay(props);

  const { timelineWidthPx, laneByIndex, laneCount, layoutHeightPx, segments, selectedIdx, durationSec } =
    props;

  const segmentIndices = useMemo(
    () =>
      selectOverlayRenderedSegmentIndices({
        segments,
        dominantSpanIndices: props.dominantSpanIndices,
      }),
    [segments, props.dominantSpanIndices],
  );

  return (
    <div
      className="waveform-segment-overlay"
      title="框选：Shift 允许重叠，Alt+Shift 拒绝重叠，Alt 关闭吸附"
      onPointerDown={onShellPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {segmentIndices.map((idx) => {
        const seg = segments[idx];
        if (!seg) return null;
        const bounds = segmentBoundsAt(idx);
        if (!bounds) return null;
        const geom = segmentOverlayGeometry({
          startSec: bounds.startSec,
          endSec: bounds.endSec,
          timelineWidthPx,
          durationSec,
          lane: laneByIndex[idx] ?? 0,
          laneCount,
          containerHeightPx: layoutHeightPx,
        });
        const selected = idx === selectedIdx;
        return (
          <div
            key={seg.uid ? `${seg.uid}#${idx}` : `seg-${idx}`}
            data-waveform-segment=""
            data-segment-idx={idx}
            className={`waveform-segment-region${selected ? " waveform-segment-region-selected" : ""}`}
            style={{
              left: geom.leftPx,
              width: geom.widthPx,
              top: geom.topPx,
              height: geom.heightPx,
              background: waveformRegionFillColor(seg, selected),
            }}
            onPointerDown={(ev) => onSegmentPointerDown(idx, ev)}
            onClick={(ev) => onSegmentClick(idx, ev)}
            onDoubleClick={(ev) => onSegmentDoubleClick(idx, ev)}
          >
            <span className="waveform-segment-handle waveform-segment-handle-start" aria-hidden />
            <span className="waveform-segment-handle waveform-segment-handle-end" aria-hidden />
          </div>
        );
      })}
      {createPreview ? (
        <div
          className="waveform-segment-create-preview"
          style={computeCreatePreviewStyle({
            createPreview,
            timelineWidthPx,
            durationSec,
          })}
          aria-hidden
        />
      ) : null}
    </div>
  );
});
