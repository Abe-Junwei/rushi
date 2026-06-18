import type { RefObject } from "react";
import { CspLayout } from "./CspLayout";

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
  hidePlayheadReact?: boolean;
  playheadLeft?: string;
  showPlayheadLine?: boolean;
  rulerHeightPx: number;
  /** embedded + overlay：刻度从波形底边向上 */
  embeddedOverlay?: boolean;
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
  hidePlayheadReact = false,
  playheadLeft = "-1%",
  showPlayheadLine = true,
  rulerHeightPx,
  embeddedOverlay = false,
}: WaveformTimeRulerTickLayerProps) {
  const isVisibleViewportPx = (displayPx: number, marginPx: number) =>
    displayPx >= -marginPx && displayPx <= renderWidthPx + marginPx;
  const tickTopY = embeddedOverlay ? undefined : 0;
  const tickBottomY = (len: number) =>
    embeddedOverlay ? rulerHeightPx - len : len;
  const labelClassTop = embeddedOverlay ? "bottom-0 pb-px" : embedded ? "top-0" : "top-[8px]";
  const embeddedLabelClass = embedded ? "text-notion-text/72" : ink ? "text-notion-bg/60" : "text-zen-ink/55";

  return (
    <>
      <svg className="absolute inset-0 h-[22px] w-full overflow-visible" aria-hidden>
        {ticks.map(({ t, major }) => {
          const displayPx = timelineToDisplayPx(t);
          if (viewportSpace && !isVisibleViewportPx(displayPx, 8)) {
            return null;
          }
          const tickX = viewportSpace ? `${displayPx}px` : `${(t / Math.max(durationSec, 1e-6)) * 100}%`;
          const tickLen = embedded ? (major ? 7 : 3) : major ? 8 : 4;
          const isHighlightedMajor =
            embedded && major && highlightedMajorTickTime != null && Math.abs(t - highlightedMajorTickTime) < 1e-6;
          return (
            <g key={`tk-${t}`}>
              <line
                x1={tickX}
                x2={tickX}
                y1={embeddedOverlay ? tickBottomY(tickLen) : tickTopY}
                y2={embeddedOverlay ? rulerHeightPx : tickBottomY(tickLen)}
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
        {showPlayheadLine ? (
          <line
            ref={playheadLineRef}
            x1={hidePlayheadReact ? (viewportSpace ? "-8px" : "-1%") : playheadLeft}
            x2={hidePlayheadReact ? (viewportSpace ? "-8px" : "-1%") : playheadLeft}
            y1={embeddedOverlay ? 0 : -2}
            y2={rulerHeightPx}
            className={
              hidePlayheadReact
                ? "stroke-zen-saffron/90"
                : embedded
                  ? interactionActive
                    ? "stroke-zen-saffron/90"
                    : "stroke-zen-saffron/90"
                  : ink
                    ? "stroke-zen-saffron/90"
                    : "stroke-zen-ink"
            }
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-0 h-[22px]">
        {majorTicks.filter((_, index) => index % embeddedLabelStride === 0).map(({ t }) => {
          const displayPx = timelineToDisplayPx(t);
          if (viewportSpace && !isVisibleViewportPx(displayPx, 4)) {
            return null;
          }
          const isHighlightedMajor =
            embedded && highlightedMajorTickTime != null && Math.abs(t - highlightedMajorTickTime) < 1e-6;
          return (
            <CspLayout
              key={`lb-${t}`}
              as="span"
              className={`absolute text-label tabular-nums leading-none ${labelClassTop} ${
                embedded
                  ? interactionActive && isHighlightedMajor
                    ? "font-medium text-notion-text/90"
                    : embeddedLabelClass
                  : ink
                    ? "text-notion-bg/60"
                    : "text-zen-ink/55"
              }`}
              layout={{
                left: viewportSpace ? `${displayPx}px` : `${(t / Math.max(durationSec, 1e-6)) * 100}%`,
                transform: "translateX(2px)",
              }}
            >
              {formatMediaTime(t)}
            </CspLayout>
          );
        })}
      </div>
    </>
  );
}
