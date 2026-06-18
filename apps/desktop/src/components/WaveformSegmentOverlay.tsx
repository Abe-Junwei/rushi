import { memo, useMemo } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";
import { useWaveformSegmentOverlay } from "../hooks/useWaveformSegmentOverlay";
import { resolveWaveformSegmentFillState } from "../utils/segmentChrome";
import { computeCreatePreviewStyle } from "../utils/waveformSegmentOverlayGeometry";
import { selectOverlayInteractiveSegmentIndices } from "../utils/waveformSegmentOverlayVisibility";
import { WaveformSegmentRegionItem } from "./WaveformSegmentRegionItem";
import { CspLayout } from "./CspLayout";

export type WaveformSegmentOverlayProps = {
  disabled: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  selectedIndices?: ReadonlySet<number>;
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
  revealSelectedSegmentInViewport?: () => void;
  onClearMultiSelection?: () => void;
  isMultiSegmentSelection?: () => boolean;
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

  const {
    timelineWidthPx,
    laneByIndex,
    laneCount,
    layoutHeightPx,
    segments,
    selectedIdx,
    durationSec,
  } = props;

  const segmentIndices = useMemo(
    () =>
      selectOverlayInteractiveSegmentIndices({
        segmentCount: segments.length,
        selectedIdx,
        selectedIndices: props.selectedIndices,
        selectionLo: props.selectionLo,
        selectionHi: props.selectionHi,
        selectionCount: props.selectionCount,
        isContiguousSelection: props.isContiguousSelection,
        draftIdx: segmentDraftIdx,
      }),
    [
      segments.length,
      selectedIdx,
      props.selectedIndices,
      props.selectionLo,
      props.selectionHi,
      props.selectionCount,
      props.isContiguousSelection,
      segmentDraftIdx,
    ],
  );

  const multiSelectActive = (props.selectedIndices?.size ?? 0) > 1;

  return (
    <div
      className="waveform-segment-overlay"
      // Local interaction hints (not in editorShortcutRegistry).
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
        const { selected, inSelection } = resolveWaveformSegmentFillState({
          idx,
          selectedIdx,
          selectedIndices: props.selectedIndices,
        });
        return (
          <WaveformSegmentRegionItem
            key={seg.uid ? `${seg.uid}#${idx}` : `seg-${idx}`}
            idx={idx}
            seg={seg}
            startSec={bounds.startSec}
            endSec={bounds.endSec}
            selected={selected}
            inSelection={inSelection}
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
      {createPreview ? (
        <CspLayout
          className="waveform-segment-create-preview"
          layout={computeCreatePreviewStyle({
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
