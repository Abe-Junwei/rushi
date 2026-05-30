import type { RefObject } from "react";

type RulerTick = { t: number; major: boolean };

type WaveformTimeRulerTickLayerProps = {
  ticks: RulerTick[];
  majorTicks: RulerTick[];
  embeddedLabelStride: number;
  viewportSpace: boolean;
  renderWidthPx: number;
  durationSec: number;
  embedded: boolean;
  ink: boolean;
  interactionActive: boolean;
  highlightedMajorTickTime: number | null;
  timelineToDisplayPx: (timeSec: number) => number;
  formatMediaTime: (sec: number) => string;
  playheadLineRef?: RefObject<SVGLineElement | null>;
  hidePlayheadReact: boolean;
  playheadLeft: string;
  rulerHeightPx: number;
};

export function WaveformTimeRulerTickLayer({
  ticks,
  majorTicks,
  embeddedLabelStride,
  viewportSpace,
  renderWidthPx,
  durationSec,
  embedded,
  ink,
  interactionActive,
  highlightedMajorTickTime,
  timelineToDisplayPx,
  formatMediaTime,
  playheadLineRef,
  hidePlayheadReact,
  playheadLeft,
  rulerHeightPx,
}: WaveformTimeRulerTickLayerProps) {
  return (
    <>
      <svg className="absolute inset-0 h-[22px] w-full overflow-visible" aria-hidden>
        {ticks.map(({ t, major }) => {
          const displayPx = timelineToDisplayPx(t);
          if (viewportSpace && (displayPx < -8 || displayPx > renderWidthPx + 8)) {
            return null;
          }
          const tickX = viewportSpace ? `${displayPx}px` : `${(t / Math.max(durationSec, 1e-6)) * 100}%`;
          const isHighlightedMajor =
            embedded && major && highlightedMajorTickTime != null && Math.abs(t - highlightedMajorTickTime) < 1e-6;
          return (
            <g key={`tk-${t}`}>
              <line
                x1={tickX}
                x2={tickX}
                y1={0}
                y2={embedded ? (major ? 7 : 3) : major ? 8 : 4}
                className={
                  embedded
                    ? interactionActive && isHighlightedMajor
                      ? "stroke-notion-text/85"
                      : major
                        ? "stroke-notion-text/62"
                        : "stroke-notion-text/38"
                    : ink
                      ? major
                        ? "stroke-notion-bg/55"
                        : "stroke-notion-bg/30"
                      : major
                        ? "stroke-zen-ink/45"
                        : "stroke-zen-ink/22"
                }
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
        <line
          ref={playheadLineRef}
          x1={hidePlayheadReact ? (viewportSpace ? "-8px" : "-1%") : playheadLeft}
          x2={hidePlayheadReact ? (viewportSpace ? "-8px" : "-1%") : playheadLeft}
          y1={-2}
          y2={rulerHeightPx}
          className={
            hidePlayheadReact
              ? "stroke-zen-saffron/58"
              : embedded
                ? interactionActive
                  ? "stroke-zen-saffron/86"
                  : "stroke-zen-saffron/58"
                : ink
                  ? "stroke-zen-saffron/90"
                  : "stroke-zen-ink"
          }
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 h-[22px]">
        {majorTicks.filter((_, index) => index % embeddedLabelStride === 0).map(({ t }) => {
          const displayPx = timelineToDisplayPx(t);
          if (viewportSpace && (displayPx < -4 || displayPx > renderWidthPx + 4)) {
            return null;
          }
          const isHighlightedMajor =
            embedded && highlightedMajorTickTime != null && Math.abs(t - highlightedMajorTickTime) < 1e-6;
          return (
            <span
              key={`lb-${t}`}
              className={`absolute top-[8px] text-[11px] tabular-nums ${
                embedded
                  ? interactionActive && isHighlightedMajor
                    ? "text-notion-text/90"
                    : "text-notion-text/68"
                  : ink
                    ? "text-notion-bg/60"
                    : "text-zen-ink/55"
              }`}
              style={{
                left: viewportSpace ? `${displayPx}px` : `${(t / Math.max(durationSec, 1e-6)) * 100}%`,
                transform: "translateX(2px)",
              }}
            >
              {formatMediaTime(t)}
            </span>
          );
        })}
      </div>
    </>
  );
}
