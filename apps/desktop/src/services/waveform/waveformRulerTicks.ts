const RULER_NICE_STEPS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const;
const RULER_SUB_DIVS = [10, 5, 4, 2, 1] as const;

export type RulerTick = { t: number; major: boolean };

export function pickRulerTickSteps(pxPerSec: number): { majorStep: number; minorStep: number } {
  const approx = Math.max(pxPerSec, 1e-6);
  const majorStep = RULER_NICE_STEPS.find((s) => s * approx >= 120) ?? RULER_NICE_STEPS[RULER_NICE_STEPS.length - 1];
  const subDiv = RULER_SUB_DIVS.find((d) => (majorStep / d) * approx >= 28) ?? 1;
  const minorStep = majorStep / subDiv;
  return { majorStep, minorStep };
}

export function buildVisibleRulerTicks(input: {
  durationSec: number;
  tickPxPerSec: number;
  visibleStart: number;
  visibleEnd: number;
}): { ticks: RulerTick[]; majorStep: number } {
  const { durationSec, tickPxPerSec, visibleStart, visibleEnd } = input;
  const { majorStep: maj, minorStep: min } = pickRulerTickSteps(tickPxPerSec);
  const dur = Math.max(durationSec, 0);
  const list: RulerTick[] = [];
  const viewStart = Math.max(0, visibleStart - min * 2);
  const viewEnd = Math.min(dur, visibleEnd + min * 2);
  const t0 = Math.max(0, Math.floor(viewStart / min) * min);
  for (let t = t0; t <= viewEnd + 1e-9; t += min) {
    const rounded = Math.round(t * 1e6) / 1e6;
    if (rounded > viewEnd) break;
    const ratio = rounded / maj;
    const major = Math.abs(ratio - Math.round(ratio)) < 1e-6;
    list.push({ t: rounded, major });
  }
  return { ticks: list, majorStep: maj };
}

export function computeEmbeddedRulerLabelStride(
  embedded: boolean,
  majorStep: number,
  tickPxPerSec: number,
): number {
  if (!embedded) return 1;
  const majorStepPx = majorStep * tickPxPerSec;
  if (majorStepPx < 88) return 3;
  if (majorStepPx < 144) return 2;
  return 1;
}

export function findHighlightedRulerMajorTickTime(
  majorTicks: RulerTick[],
  currentTimeSec: number,
  majorStep: number,
): number | null {
  if (majorTicks.length === 0) return null;
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
}
