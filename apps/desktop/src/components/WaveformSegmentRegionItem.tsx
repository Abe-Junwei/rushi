import { memo, useMemo, type MouseEvent, type PointerEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { waveformRegionFillColor } from "../utils/segmentChrome";
import type { segmentOverlayGeometry } from "../utils/waveformSegmentBounds";

type SegmentOverlayGeometryFn = typeof segmentOverlayGeometry;

export type WaveformSegmentRegionItemProps = {
  idx: number;
  seg: SegmentDto;
  startSec: number;
  endSec: number;
  selected: boolean;
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
    selected,
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
      <div
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
  },
  (prev, next) =>
    prev.idx === next.idx &&
    prev.seg === next.seg &&
    prev.startSec === next.startSec &&
    prev.endSec === next.endSec &&
    prev.selected === next.selected &&
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
