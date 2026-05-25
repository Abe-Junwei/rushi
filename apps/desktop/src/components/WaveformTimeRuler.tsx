import { memo, useCallback, useMemo, useRef } from "react";

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
  /** ink：深色条上（默认）；light：白底波形区下方 */
  appearance?: "ink" | "light";
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
  pxPerSec,
  currentTimeSec,
  formatMediaTime,
  disabled,
  onSeekFromTierClientX,
  onSetScrollLeftPx,
  appearance = "ink",
}: WaveformTimeRulerProps) {
  const ink = appearance === "ink";
  const rulerDragRef = useRef({ dragging: false, startX: 0, startScroll: 0 });

  const { ticks } = useMemo(() => {
    const { majorStep: maj, minorStep: min } = pickSteps(pxPerSec);
    const dur = Math.max(durationSec, 0);
    const list: Array<{ t: number; major: boolean }> = [];
    const t0 = 0;
    for (let t = t0; t <= dur + 1e-9; t += min) {
      const rounded = Math.round(t * 1e6) / 1e6;
      if (rounded > dur) break;
      const ratio = rounded / maj;
      const major = Math.abs(ratio - Math.round(ratio)) < 1e-6;
      list.push({ t: rounded, major });
    }
    return { ticks: list };
  }, [durationSec, pxPerSec]);

  const majorTicks = useMemo(() => ticks.filter((tick) => tick.major), [ticks]);

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
        ink
          ? "relative shrink-0 border-t border-zen-paper/10 bg-black/25"
          : "relative shrink-0 border-t border-black/10 bg-zen-paper"
      }
      style={{ width: timelineWidthPx, height: RULER_H }}
    >
      <div
        className={`relative h-[22px] cursor-grab select-none active:cursor-grabbing ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onMouseDown={onRulerMouseDown}
      >
        <svg className="absolute inset-0 h-[22px] w-full overflow-visible" aria-hidden>
          {ticks.map(({ t, major }) => {
            const leftPct = (t / Math.max(durationSec, 1e-6)) * 100;
            return (
              <g key={`tk-${t}`}>
                <line
                  x1={`${leftPct}%`}
                  x2={`${leftPct}%`}
                  y1={0}
                  y2={major ? 8 : 4}
                  className={
                    ink
                      ? major
                        ? "stroke-white/55"
                        : "stroke-white/30"
                      : major
                        ? "stroke-black/45"
                        : "stroke-black/22"
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
            className={ink ? "stroke-zen-saffron/90" : "stroke-zen-ink"}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 h-[22px]">
          {majorTicks.map(({ t }) => {
            const leftPct = (t / Math.max(durationSec, 1e-6)) * 100;
            return (
              <span
                key={`lb-${t}`}
                className={`absolute top-[8px] text-[10px] tabular-nums ${ink ? "text-white/60" : "text-black/55"}`}
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
