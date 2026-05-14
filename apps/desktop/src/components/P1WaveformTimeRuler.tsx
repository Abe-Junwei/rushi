import { memo, useCallback, useMemo, useRef } from "react";

export type P1WaveformTimeRulerProps = {
  durationSec: number;
  timelineWidthPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  pxPerSec: number;
  currentTimeSec: number;
  formatMediaTime: (sec: number) => string;
  disabled?: boolean;
  /** ink：深色条上（默认）；light：白底波形区下方 */
  appearance?: "ink" | "light";
  /** 点击时间尺（相对 tier 视口）寻位 */
  onSeekFromTierClientX: (clientX: number) => void;
  /** 快速定位条：绝对时间 + 将视口大致居中到该时间 */
  onPickAbsoluteTime: (timeSec: number, mode: "seek" | "seekAndCenterViewport") => void;
  onSetScrollLeftPx: (px: number) => void;
};

const NICE_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const SUB_DIVS = [10, 5, 4, 2, 1];
const RULER_H = 22;

function pickSteps(pxPerSec: number, windowSec: number) {
  const approx = Math.max(pxPerSec, 1e-6);
  const win = Math.max(windowSec, 1e-6);
  const targetMajors = 6;
  const idealMajor = win / targetMajors;

  let majorStep = NICE_STEPS[NICE_STEPS.length - 1];
  for (const s of NICE_STEPS) {
    if (s >= idealMajor * 0.82) {
      majorStep = s;
      break;
    }
  }
  let guard = 0;
  while (win / majorStep > 11 && majorStep < NICE_STEPS[NICE_STEPS.length - 1] && guard < 24) {
    const i = NICE_STEPS.indexOf(majorStep);
    majorStep = NICE_STEPS[Math.min(i < 0 ? 0 : i + 1, NICE_STEPS.length - 1)];
    guard++;
  }
  guard = 0;
  while (win / majorStep < 3.2 && majorStep > NICE_STEPS[0] && guard < 24) {
    const i = NICE_STEPS.indexOf(majorStep);
    majorStep = NICE_STEPS[Math.max((i < 0 ? 0 : i) - 1, 0)];
    guard++;
  }

  const subDiv = SUB_DIVS.find((d) => (majorStep / d) * approx >= 24) ?? 1;
  const minorStep = majorStep / subDiv;
  return { majorStep, minorStep };
}

export const P1WaveformTimeRuler = memo(function P1WaveformTimeRuler({
  durationSec,
  timelineWidthPx,
  scrollLeftPx,
  viewportWidthPx,
  pxPerSec,
  currentTimeSec,
  formatMediaTime,
  disabled,
  onSeekFromTierClientX,
  onPickAbsoluteTime,
  onSetScrollLeftPx,
  appearance = "ink",
}: P1WaveformTimeRulerProps) {
  const ink = appearance === "ink";
  const rulerDragRef = useRef({ dragging: false, startX: 0, startScroll: 0 });
  const overviewDragRef = useRef(false);

  const { startSec, endSec, windowSec } = useMemo(() => {
    const dur = Math.max(durationSec, 1e-6);
    const tw = Math.max(timelineWidthPx, 1);
    const sl = Math.max(0, scrollLeftPx);
    const vw = Math.max(1, viewportWidthPx);
    const start = (sl / tw) * dur;
    const end = ((sl + vw) / tw) * dur;
    return {
      startSec: Math.max(0, Math.min(start, dur)),
      endSec: Math.max(0, Math.min(end, dur)),
      windowSec: Math.max(1e-6, Math.min(end, dur) - Math.max(0, start)),
    };
  }, [durationSec, timelineWidthPx, scrollLeftPx, viewportWidthPx]);

  const { ticks } = useMemo(() => {
    const { majorStep: maj, minorStep: min } = pickSteps(pxPerSec, windowSec);
    const dur = Math.max(durationSec, 0);
    const list: Array<{ t: number; major: boolean }> = [];
    const t0 = Math.max(0, Math.floor(startSec / min) * min);
    for (let t = t0; t <= Math.min(endSec, dur) + 1e-9; t += min) {
      const rounded = Math.round(t * 1e6) / 1e6;
      if (rounded > dur) break;
      const ratio = rounded / maj;
      const major = Math.abs(ratio - Math.round(ratio)) < 1e-6;
      list.push({ t: rounded, major });
    }
    return { ticks: list };
  }, [durationSec, endSec, pxPerSec, startSec, windowSec]);

  const playheadInWindowPct = useMemo(() => {
    const p = ((currentTimeSec - startSec) / windowSec) * 100;
    return `${Math.max(-1, Math.min(101, p))}%`;
  }, [currentTimeSec, startSec, windowSec]);

  const overviewViewport = useMemo(() => {
    const tw = Math.max(timelineWidthPx, 1);
    const leftPct = (scrollLeftPx / tw) * 100;
    const widthPct = Math.max(0.6, (viewportWidthPx / tw) * 100);
    return { leftPct, widthPct };
  }, [scrollLeftPx, timelineWidthPx, viewportWidthPx]);

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

  const seekOverview = useCallback(
    (clientX: number, el: HTMLDivElement) => {
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(rect.width, 1);
      const dur = Math.max(durationSec, 1e-6);
      const t = Math.max(0, Math.min(dur, ratio * dur));
      onPickAbsoluteTime(t, "seekAndCenterViewport");
    },
    [durationSec, onPickAbsoluteTime],
  );

  if (durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  return (
    <div
      className={
        ink
          ? "relative w-full shrink-0 border-t border-zen-paper/10 bg-black/25"
          : "relative w-full shrink-0 border-t border-black/10 bg-zen-paper"
      }
      style={{ height: RULER_H + 6 }}
    >
      <div
        className={`relative h-[22px] cursor-grab select-none active:cursor-grabbing ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onMouseDown={onRulerMouseDown}
      >
        <svg className="absolute inset-0 h-[22px] w-full overflow-visible" aria-hidden>
          {ticks.map(({ t, major }) => {
            const leftPct = ((t - startSec) / windowSec) * 100;
            if (leftPct < -1 || leftPct > 101) return null;
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
                {major ? (
                  <text
                    x={`${leftPct}%`}
                    y={16}
                    dx={2}
                    className={ink ? "fill-white/60" : "fill-black/55"}
                    style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatMediaTime(t)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <line
            x1={playheadInWindowPct}
            x2={playheadInWindowPct}
            y1={-2}
            y2={RULER_H}
            className={ink ? "stroke-zen-saffron/90" : "stroke-zen-ink"}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div
        className={`absolute bottom-0 left-0 right-0 h-1.5 px-0 ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
        title="快速定位：点击或拖动跳转时间"
        onClick={(e) => {
          e.stopPropagation();
          seekOverview(e.clientX, e.currentTarget);
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          overviewDragRef.current = true;
          seekOverview(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (overviewDragRef.current) seekOverview(e.clientX, e.currentTarget);
        }}
        onPointerUp={(e) => {
          overviewDragRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={(e) => {
          overviewDragRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
      >
        <div className={`absolute inset-x-0 top-0.5 h-px rounded-full ${ink ? "bg-zen-paper/20" : "bg-black/12"}`} />
        <div
          className={
            ink
              ? "absolute top-0 h-[3px] rounded-full bg-zen-saffron/80 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
              : "absolute top-0 h-[3px] rounded-full bg-zen-ink shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
          }
          style={{ left: `${overviewViewport.leftPct}%`, width: `${overviewViewport.widthPct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
});
