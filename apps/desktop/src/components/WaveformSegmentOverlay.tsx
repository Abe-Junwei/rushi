import { memo, useMemo } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";
import { useWaveformSegmentOverlay } from "../hooks/useWaveformSegmentOverlay";
import { computeCreatePreviewStyle } from "../utils/waveformSegmentOverlayGeometry";
import { selectOverlayInteractiveSegmentIndices } from "../utils/waveformSegmentOverlayVisibility";
import { WaveformSegmentRegionItem } from "./WaveformSegmentRegionItem";

export type WaveformSegmentOverlayProps = {
  disabled: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  timelineWidthPx: number;
  durationSec: number;
  layoutHeightPx: number;
  laneByIndex: number[];
  laneCount: number;
  dominantSpanIndices?: number[];
  enableCreateRange: boolean;
  clientXToTimeSec: (clientX: number) => number;
  getPlayheadSec: () => number;
  onDraftIdxChange?: (idx: number | null) => void;
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
    segmentDraftIdx,
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
      selectOverlayInteractiveSegmentIndices({
        segmentCount: segments.length,
        selectedIdx,
        draftIdx: segmentDraftIdx,
      }),
    [segments.length, selectedIdx, segmentDraftIdx],
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
        const selected = idx === selectedIdx;
        return (
          <WaveformSegmentRegionItem
            key={seg.uid ? `${seg.uid}#${idx}` : `seg-${idx}`}
            idx={idx}
            seg={seg}
            startSec={bounds.startSec}
            endSec={bounds.endSec}
            selected={selected}
            showHandles={selected || idx === segmentDraftIdx}
            timelineWidthPx={timelineWidthPx}
            durationSec={durationSec}
            lane={laneByIndex[idx] ?? 0}
            laneCount={laneCount}
            layoutHeightPx={layoutHeightPx}
            segmentOverlayGeometry={segmentOverlayGeometry}
            onSegmentPointerDown={onSegmentPointerDown}
            onSegmentClick={onSegmentClick}
            onSegmentDoubleClick={onSegmentDoubleClick}
          />
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
