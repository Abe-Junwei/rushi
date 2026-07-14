import { memo, useMemo, type MouseEvent, type PointerEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { useSegmentRowSelection } from "../hooks/useSegmentRowSelection";
import { waveformRegionFillColor } from "../utils/segmentChrome";
import type { segmentOverlayGeometry } from "../utils/waveformSegmentBounds";
import { CspLayout } from "./CspLayout";

type SegmentOverlayGeometryFn = typeof segmentOverlayGeometry;

export type WaveformSegmentRegionItemProps = {
  idx: number;
  seg: SegmentDto;
  startSec: number;
  endSec: number;
  isDraftSegment?: boolean;
  multiSelectActive?: boolean;
  /** Filtered-out primary: keep chrome, block pointer interaction. */
  visualOnly?: boolean;
  timelineWidthPx: number;
  durationSec: number;
  lane: number;
  laneCount: number;
  layoutHeightPx: number;
  segmentOverlayGeometry: SegmentOverlayGeometryFn;
  onSegmentPointerDown: (idx: number, ev: PointerEvent<HTMLElement>) => void;
  onSegmentClick: (idx: number, ev: MouseEvent<HTMLElement>) => void;
  onSegmentDoubleClick: (idx: number, ev: MouseEvent<HTMLElement>) => void;
};

export const WaveformSegmentRegionItem = memo(
  function WaveformSegmentRegionItem({
    idx,
    seg,
    startSec,
    endSec,
    isDraftSegment = false,
    multiSelectActive = false,
    visualOnly = false,
    timelineWidthPx,
    durationSec,
    lane,
    laneCount,
    layoutHeightPx,
    segmentOverlayGeometry,
    onSegmentPointerDown,
    onSegmentClick,
    onSegmentDoubleClick,
  }: WaveformSegmentRegionItemProps) {
    const { selected, inSelection } = useSegmentRowSelection(idx);
    // Frozen segments are boundary-locked: no drag handles even when selected.
    // Visual-only (hidden primary) also drops handles.
    const showHandles = !visualOnly && !seg.frozen && (isDraftSegment || selected);

    const geom = useMemo(
      () =>
        segmentOverlayGeometry({
          startSec,
          endSec,
          timelineWidthPx,
          durationSec,
          lane,
          laneCount,
          containerHeightPx: layoutHeightPx,
        }),
      [
        segmentOverlayGeometry,
        startSec,
        endSec,
        timelineWidthPx,
        durationSec,
        lane,
        laneCount,
        layoutHeightPx,
      ],
    );

    return (
      <CspLayout
        data-waveform-segment=""
        data-segment-idx={idx}
        layout={{
          left: geom.leftPx,
          width: geom.widthPx,
          top: geom.topPx,
          height: geom.heightPx,
          // backgroundColor (not shorthand) so .waveform-segment-region-frozen hatch shows.
          backgroundColor: waveformRegionFillColor(seg, selected, inSelection, undefined, {
            multiSelectActive,
          }),
        }}
        className={[
          "waveform-segment-region",
          seg.low_confidence ? "waveform-segment-region-low-confidence" : "",
          seg.frozen ? "waveform-segment-region-frozen" : "",
          selected ? "waveform-segment-region-selected" : "",
          inSelection ? "waveform-segment-region-in-selection" : "",
          visualOnly ? "pointer-events-none" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={visualOnly ? undefined : (ev) => onSegmentPointerDown(idx, ev)}
        onClick={visualOnly ? undefined : (ev) => onSegmentClick(idx, ev)}
        onDoubleClick={visualOnly ? undefined : (ev) => onSegmentDoubleClick(idx, ev)}
      >
        {showHandles ? (
          <>
            <span className="waveform-segment-handle waveform-segment-handle-start" aria-hidden />
            <span className="waveform-segment-handle waveform-segment-handle-end" aria-hidden />
          </>
        ) : null}
      </CspLayout>
    );
  },
  (prev, next) =>
    prev.idx === next.idx &&
    prev.seg === next.seg &&
    prev.startSec === next.startSec &&
    prev.endSec === next.endSec &&
    prev.isDraftSegment === next.isDraftSegment &&
    prev.multiSelectActive === next.multiSelectActive &&
    prev.visualOnly === next.visualOnly &&
    prev.timelineWidthPx === next.timelineWidthPx &&
    prev.durationSec === next.durationSec &&
    prev.lane === next.lane &&
    prev.laneCount === next.laneCount &&
    prev.layoutHeightPx === next.layoutHeightPx &&
    prev.segmentOverlayGeometry === next.segmentOverlayGeometry &&
    prev.onSegmentPointerDown === next.onSegmentPointerDown &&
    prev.onSegmentClick === next.onSegmentClick &&
    prev.onSegmentDoubleClick === next.onSegmentDoubleClick,
);
