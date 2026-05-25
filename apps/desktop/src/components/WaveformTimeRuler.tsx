import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type WaveformTimeRulerProps = {
  durationSec: number;
  timelineWidthPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  pxPerSec: number;
  rulerView?: { start: number; end: number } | null;
  currentTimeSec: number;
  formatMediaTime: (sec: number) => string;
  disabled?: boolean;
  /** ink：深色条上（默认）；light：浅色独立条；embedded：嵌入波形底部 */
  appearance?: "ink" | "light" | "embedded";
  /** 点击时间尺（相对 tier 视口）寻位 */
  onSeekFromTierClientX: (clientX: number) => void;
  onSetScrollLeftPx: (px: number) => void;
};

const NICE_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const SUB_DIVS = [10, 5, 4, 2, 1];
const RULER_H = 22;

function pickSteps(pxPerSec: number) {
  const approx = Math.max(pxPerSec, 1e-6);
  const majorStep = NICE_STEPS.find((s) => s * approx >= 120) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const subDiv = SUB_DIVS.find((d) => (majorStep / d) * approx >= 28) ?? 1;
  const minorStep = majorStep / subDiv;
  return { majorStep, minorStep };
}

export const WaveformTimeRuler = memo(function WaveformTimeRuler({
  durationSec,
  timelineWidthPx,
  scrollLeftPx,
  viewportWidthPx,
  pxPerSec,
  rulerView,
  currentTimeSec,
  formatMediaTime,
  disabled,
  onSeekFromTierClientX,
  onSetScrollLeftPx,
  appearance = "ink",
}: WaveformTimeRulerProps) {
  const ink = appearance === "ink";
  const embedded = appearance === "embedded";
  const rulerDragRef = useRef({ dragging: false, startX: 0, startScroll: 0 });
  const prevCurrentTimeRef = useRef<number | null>(null);
  const interactionFadeTimeoutRef = useRef<number | null>(null);
  const [interactionActive, setInteractionActive] = useState(false);
  const visibleView = useMemo(() => {
    const derivedStart = Math.max(0, scrollLeftPx / Math.max(pxPerSec, 1e-6));
    const derivedEnd = Math.min(
      Math.max(durationSec, 0),
      Math.max(derivedStart, (scrollLeftPx + Math.max(viewportWidthPx, 1)) / Math.max(pxPerSec, 1e-6)),
    );
    return rulerView ?? { start: derivedStart, end: derivedEnd };
  }, [durationSec, pxPerSec, rulerView, scrollLeftPx, viewportWidthPx]);

  const { ticks, majorStep } = useMemo(() => {
    const { majorStep: maj, minorStep: min } = pickSteps(pxPerSec);
    const dur = Math.max(durationSec, 0);
    const list: Array<{ t: number; major: boolean }> = [];
    const viewStart = Math.max(0, visibleView.start - min * 2);
    const viewEnd = Math.min(dur, visibleView.end + min * 2);
    const t0 = Math.max(0, Math.floor(viewStart / min) * min);
    for (let t = t0; t <= viewEnd + 1e-9; t += min) {
      const rounded = Math.round(t * 1e6) / 1e6;
      if (rounded > viewEnd) break;
      const ratio = rounded / maj;
      const major = Math.abs(ratio - Math.round(ratio)) < 1e-6;
      list.push({ t: rounded, major });
    }
    return { ticks: list, majorStep: maj };
  }, [durationSec, pxPerSec, visibleView]);

  const majorTicks = useMemo(() => ticks.filter((tick) => tick.major), [ticks]);
  const embeddedLabelStride = useMemo(() => {
    if (!embedded) return 1;
    const majorStepPx = majorStep * pxPerSec;
    if (majorStepPx < 88) return 3;
    if (majorStepPx < 144) return 2;
    return 1;
  }, [embedded, majorStep, pxPerSec]);
  const highlightedMajorTickTime = useMemo(() => {
    if (!embedded || majorTicks.length === 0) return null;
    let closest = majorTicks[0]?.t ?? null;
    let minDistance = Number.POSITIVE_INFINITY;
    for (const tick of majorTicks) {
      const distance = Math.abs(tick.t - currentTimeSec);
      if (distance < minDistance) {
        minDistance = distance;
        closest = tick.t;
      }
    }
    return minDistance <= majorStep * 0.75 ? closest : null;
  }, [currentTimeSec, embedded, majorStep, majorTicks]);

  useEffect(() => {
    if (!embedded) return;
    const prev = prevCurrentTimeRef.current;
    prevCurrentTimeRef.current = currentTimeSec;
    if (prev == null || Math.abs(currentTimeSec - prev) < 1e-4) return;
    setInteractionActive(true);
    if (interactionFadeTimeoutRef.current != null) {
      window.clearTimeout(interactionFadeTimeoutRef.current);
    }
    interactionFadeTimeoutRef.current = window.setTimeout(() => {
      interactionFadeTimeoutRef.current = null;
      setInteractionActive(false);
    }, 260);
    return () => {
      if (interactionFadeTimeoutRef.current != null) {
        window.clearTimeout(interactionFadeTimeoutRef.current);
        interactionFadeTimeoutRef.current = null;
      }
    };
  }, [currentTimeSec, embedded]);

  const playheadPct = useMemo(() => {
    const dur = Math.max(durationSec, 1e-6);
    const p = (currentTimeSec / dur) * 100;
    return `${Math.max(-1, Math.min(101, p))}%`;
  }, [currentTimeSec, durationSec]);

  const onRulerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      rulerDragRef.current = { dragging: false, startX: e.clientX, startScroll: scrollLeftPx };
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - rulerDragRef.current.startX;
        if (Math.abs(dx) > 3) rulerDragRef.current.dragging = true;
        if (rulerDragRef.current.dragging) {
          onSetScrollLeftPx(rulerDragRef.current.startScroll - dx);
        }
      };
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (!rulerDragRef.current.dragging) {
          onSeekFromTierClientX(ev.clientX);
        }
        rulerDragRef.current.dragging = false;
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [disabled, onSeekFromTierClientX, onSetScrollLeftPx, scrollLeftPx],
  );

  if (durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  return (
    <div
      className={
        embedded
          ? "relative shrink-0"
          : ink
          ? "relative shrink-0 border-t border-zen-paper/10 bg-zen-ink/25"
          : "relative shrink-0 border-t border-zen-ink/10 bg-zen-paper"
      }
      style={{ width: timelineWidthPx, height: RULER_H }}
    >
      {embedded ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-notion-sidebar/74 via-notion-sidebar/42 to-transparent"
        />
      ) : null}
      <div
        className={`relative h-[22px] cursor-grab select-none active:cursor-grabbing ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onMouseDown={onRulerMouseDown}
      >
        <svg className="absolute inset-0 h-[22px] w-full overflow-visible" aria-hidden>
          {ticks.map(({ t, major }) => {
            const leftPct = (t / Math.max(durationSec, 1e-6)) * 100;
            const isHighlightedMajor = embedded && major && highlightedMajorTickTime != null && Math.abs(t - highlightedMajorTickTime) < 1e-6;
            return (
              <g key={`tk-${t}`}>
                <line
                  x1={`${leftPct}%`}
                  x2={`${leftPct}%`}
                  y1={0}
                  y2={embedded ? (major ? 7 : 3) : major ? 8 : 4}
                  className={
                    embedded
                      ? interactionActive && isHighlightedMajor
                        ? "stroke-notion-bg/58"
                        : major
                        ? "stroke-notion-bg/34"
                        : "stroke-notion-bg/16"
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
            x1={playheadPct}
            x2={playheadPct}
            y1={-2}
            y2={RULER_H}
            className={
              embedded
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
            const leftPct = (t / Math.max(durationSec, 1e-6)) * 100;
            const isHighlightedMajor =
              embedded && highlightedMajorTickTime != null && Math.abs(t - highlightedMajorTickTime) < 1e-6;
            return (
              <span
                key={`lb-${t}`}
                className={`absolute top-[8px] text-[11px] tabular-nums ${
                  embedded
                    ? interactionActive && isHighlightedMajor
                      ? "text-notion-bg/74"
                      : "text-notion-bg/36"
                    : ink
                      ? "text-notion-bg/60"
                      : "text-zen-ink/55"
                }`}
                style={{ left: `${leftPct}%`, transform: "translateX(2px)" }}
              >
                {formatMediaTime(t)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
});
