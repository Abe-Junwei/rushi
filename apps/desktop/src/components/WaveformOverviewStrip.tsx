import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { COLORS } from "../config/tokens";
import { useWaveformOverviewInteraction } from "../hooks/useWaveformOverviewInteraction";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  computeOverviewPxPerSec,
  computeOverviewViewportRect,
  overviewSegmentBarPx,
} from "../utils/waveformOverviewGeometry";
import { computeTimelineWidthPx } from "../utils/pxPerSec";
import { WaveformPeaksCanvas } from "./WaveformPeaksCanvas";

export type WaveformOverviewStripProps = {
  stripHeightPx: number;
  disabled: boolean;
  isReady: boolean;
  durationSec: number;
  pxPerSec: number;
  timelineWidthPx: number;
  scrollLeftPx: number;
  mainViewportWidthPx: number;
  progressTimeSec: number;
  peakCache: PeakCache | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setTierScrollPx: (scrollLeftPx: number) => void;
  seekToTime: (timeSec: number) => void;
  onSelectSegmentAt: (idx: number) => void;
};

export const WaveformOverviewStrip = memo(function WaveformOverviewStrip({
  stripHeightPx,
  disabled,
  isReady,
  durationSec,
  pxPerSec,
  timelineWidthPx,
  scrollLeftPx,
  mainViewportWidthPx,
  progressTimeSec,
  peakCache,
  segments,
  selectedIdx,
  setTierScrollPx,
  seekToTime,
  onSelectSegmentAt,
}: WaveformOverviewStripProps) {
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const [overviewWidthPx, setOverviewWidthPx] = useState(0);

  useLayoutEffect(() => {
    const el = overviewRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setOverviewWidthPx(el.clientWidth);
    });
    ro.observe(el);
    setOverviewWidthPx(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const overviewPxPerSec = useMemo(
    () => (overviewWidthPx > 0 ? computeOverviewPxPerSec(overviewWidthPx, durationSec) : pxPerSec),
    [durationSec, overviewWidthPx, pxPerSec],
  );

  const overviewTimelineWidthPx = useMemo(
    () =>
      durationSec > 0
        ? computeTimelineWidthPx(durationSec, overviewPxPerSec)
        : 0,
    [durationSec, overviewPxPerSec],
  );

  const viewportRect = useMemo(
    () =>
      overviewWidthPx > 0
        ? computeOverviewViewportRect({
            scrollLeftPx,
            viewportWidthPx: mainViewportWidthPx,
            timelineWidthPx,
            overviewWidthPx,
          })
        : { leftPx: 0, widthPx: 0 },
    [mainViewportWidthPx, overviewWidthPx, scrollLeftPx, timelineWidthPx],
  );

  const playheadLeftPx =
    durationSec > 0 && overviewWidthPx > 0
      ? (Math.max(0, Math.min(durationSec, progressTimeSec)) / durationSec) * overviewWidthPx
      : 0;

  const interaction = useWaveformOverviewInteraction({
    disabled,
    isReady,
    overviewRef,
    durationSec,
    pxPerSec,
    timelineWidthPx,
    mainViewportWidthPx,
    scrollLeftPx,
    setTierScrollPx,
    seekToTime,
  });

  const showPeaks = Boolean(peakCache && isReady && overviewWidthPx > 0 && durationSec > 0);

  return (
    <div
      className="shrink-0 bg-notion-sidebar px-2 pb-1.5"
      style={{ height: stripHeightPx }}
    >
      <div
        ref={overviewRef}
        role="navigation"
        aria-label="全局波形导航"
        className={`relative h-full w-full overflow-hidden rounded-md bg-notion-bg/80 ${
          disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
        }`}
        onPointerDown={interaction.onOverviewPointerDown}
        onPointerMove={interaction.onOverviewPointerMove}
        onPointerUp={interaction.onOverviewPointerUp}
        onPointerCancel={interaction.onOverviewPointerCancel}
      >
        {showPeaks ? (
          <WaveformPeaksCanvas
            peakCache={peakCache}
            pxPerSec={overviewPxPerSec}
            timelineWidthPx={overviewTimelineWidthPx}
            scrollLeftPx={0}
            viewportWidthPx={overviewWidthPx}
            heightPx={Math.max(24, stripHeightPx - 8)}
            progressTimeSec={progressTimeSec}
            active
          />
        ) : (
          <div className="absolute inset-0 bg-notion-sidebar-active/40" aria-hidden />
        )}

        {segments.map((seg, idx) => {
          const bar = overviewSegmentBarPx(seg.start_sec, seg.end_sec, overviewPxPerSec);
          const selected = idx === selectedIdx;
          return (
            <button
              key={seg.uid ? `${seg.uid}#${idx}` : `ov-seg-${idx}`}
              type="button"
              data-overview-segment=""
              className={[
                "absolute top-1 bottom-1 z-[2] min-w-[2px] border-0 p-0",
                selected ? "bg-zen-saffron/55" : "bg-zen-indigo/25 hover:bg-zen-indigo/40",
              ].join(" ")}
              style={{ left: bar.leftPx, width: bar.widthPx }}
              aria-label={`语段 ${idx + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onSelectSegmentAt(idx);
              }}
            />
          );
        })}

        {overviewWidthPx > 0 && timelineWidthPx > mainViewportWidthPx ? (
          <div
            data-overview-viewport=""
            className="absolute top-0.5 bottom-0.5 z-[3] cursor-grab bg-zen-saffron/12 active:cursor-grabbing"
            style={{
              left: viewportRect.leftPx,
              width: viewportRect.widthPx,
              boxShadow: `inset 0 0 0 1px ${COLORS.saffron}`,
            }}
            aria-hidden
          />
        ) : null}

        {durationSec > 0 ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[4] w-px bg-notion-text/70"
            style={{ left: playheadLeftPx }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
});
