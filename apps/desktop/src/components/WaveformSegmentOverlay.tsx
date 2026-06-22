import { memo, useMemo, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";
import { useWaveformSegmentOverlay } from "../hooks/useWaveformSegmentOverlay";
import { useWaveformSelectionChromeView } from "../hooks/useWaveformSelectionChromeView";
import { resolveWaveformSegmentFillState } from "../utils/segmentChrome";
import { resolveWaveformSelectionRenderProjection } from "../services/waveform/waveformSelectionRenderProjection";
import { WaveformSegmentRegionItem } from "./WaveformSegmentRegionItem";
import { CspLayout } from "./CspLayout";

export type WaveformSegmentOverlayProps = {
  fileId: string | null;
  disabled: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  selectedIndices?: ReadonlySet<number>;
  filterExcludesPrimary?: boolean;
  isIndexInSelection?: (idx: number) => boolean;
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
  onSelectSegmentAt: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  onWaveformSelectionGesture?: (
    gesture: import("../services/waveform/waveformSelectionGesture").WaveformSelectionGesture,
  ) => boolean | void;
  /** @deprecated 使用 onWaveformSelectionGesture down phase */
  onPreviewSegmentSelect?: (idx: number) => boolean;
  onSelectSegmentIndices?: (indices: number[], primaryIdx: number) => void;
  getSelectedIndices?: () => ReadonlySet<number>;
  onBeginBoundsEdit?: () => void;
  onFocusWaveformShell?: () => void;
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  onCreateRange?: (
    startSec: number,
    endSec: number,
    options?: { overlapPolicy?: SegmentOverlapPolicy },
  ) => void;
  onSelectTimeRange?: (startSec: number, endSec: number) => void;
  onPlaySegment?: (idx: number) => void;
  seekToTime: (timeSec: number) => void;
  suppressPlaybackFollowForSelectionSeek?: () => void;
  onClearMultiSelection?: () => void;
  isMultiSegmentSelection?: () => boolean;
};

export const WaveformSegmentOverlay = memo(function WaveformSegmentOverlay(props: WaveformSegmentOverlayProps) {
  const createPreviewRef = useRef<HTMLElement | null>(null);

  const {
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
    bindCreatePreviewRef,
  } = useWaveformSegmentOverlay(props, createPreviewRef);

  const {
    timelineWidthPx,
    laneByIndex,
    laneCount,
    layoutHeightPx,
    segments,
    durationSec,
    fileId,
  } = props;

  const selectionView = useWaveformSelectionChromeView({
    fileId,
    selectedIdx: props.selectedIdx,
    selectedIndices: props.selectedIndices,
    selectionLo: props.selectionLo,
    selectionHi: props.selectionHi,
    selectionCount: props.selectionCount,
    isContiguousSelection: props.isContiguousSelection,
    segmentCount: segments.length,
    filterExcludesPrimary: props.filterExcludesPrimary,
  });

  const segmentIndices = useMemo(
    () =>
      resolveWaveformSelectionRenderProjection({
        segmentCount: segments.length,
        selectedIdx: selectionView.selectedIdx,
        selectedIndices: selectionView.selectedIndices,
        selectionLo: selectionView.selectionLo,
        selectionHi: selectionView.selectionHi,
        selectionCount: selectionView.selectionCount,
        isContiguousSelection: selectionView.isContiguousSelection,
        draftIdx: segmentDraftIdx,
      }).overlayInteractiveIndices,
    [
      segments.length,
      selectionView.selectedIdx,
      selectionView.selectedIndices,
      selectionView.selectionLo,
      selectionView.selectionHi,
      selectionView.selectionCount,
      selectionView.isContiguousSelection,
      segmentDraftIdx,
    ],
  );

  const multiSelectActive =
    (selectionView.selectedIndices?.size ?? 0) > 1 || selectionView.selectionCount > 1;

  return (
    <div
      className="waveform-segment-overlay"
      title="拖动空白：选中相交语段；空白处无命中则新建。Shift+拖扩展已有选区；Shift 允许重叠新建；⌘/Ctrl+点击切换选中"
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
        const { selected } = resolveWaveformSegmentFillState({
          idx,
          selectedIdx: selectionView.selectedIdx,
          selectedIndices: selectionView.selectedIndices,
          selectionLo: selectionView.selectionLo,
          selectionHi: selectionView.selectionHi,
          selectionCount: selectionView.selectionCount,
        });
        return (
          <WaveformSegmentRegionItem
            key={seg.uid ? `${seg.uid}#${idx}` : `seg-${idx}`}
            idx={idx}
            seg={seg}
            startSec={bounds.startSec}
            endSec={bounds.endSec}
            showHandles={selected || idx === segmentDraftIdx}
            multiSelectActive={multiSelectActive}
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
      <CspLayout
        ref={bindCreatePreviewRef}
        className="waveform-segment-create-preview pointer-events-none absolute top-0 z-[4] h-full bg-accent-action/20"
        layout={{}}
        aria-hidden
      />
    </div>
  );
});
