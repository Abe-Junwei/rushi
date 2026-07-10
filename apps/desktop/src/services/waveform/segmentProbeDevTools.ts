import type { SegmentDto } from "../../tauri/projectApi";

export type SegmentProbeRow = {
  i: number;
  start: number;
  end: number;
  text: string;
  stage: string | null | undefined;
  low: boolean | undefined;
};

type SegmentProbeSource = () => readonly SegmentDto[] | null | undefined;

let probeSource: SegmentProbeSource | null = null;

/** Editor registers the live `segments[]` reader for DevTools probes. */
export function registerSegmentProbeSource(source: SegmentProbeSource | null): void {
  probeSource = source;
}

export function probeSegmentsInTimeWindow(
  segments: readonly SegmentDto[],
  t0: number,
  t1: number,
): SegmentProbeRow[] {
  const lo = Math.min(t0, t1);
  const hi = Math.max(t0, t1);
  const out: SegmentProbeRow[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    if (!s) continue;
    const start = Math.min(s.start_sec, s.end_sec);
    const end = Math.max(s.start_sec, s.end_sec);
    if (end <= lo || start >= hi) continue;
    out.push({
      i,
      start: s.start_sec,
      end: s.end_sec,
      text: (s.text || "").slice(0, 24),
      stage: s.text_stage,
      low: s.low_confidence,
    });
  }
  return out;
}

export function installSegmentProbeDevTools(): void {
  if (typeof window === "undefined") return;
  const api = (t0: number, t1: number) => {
    const segments = probeSource?.() ?? null;
    if (!segments) {
      return {
        error: "no segments source — open Editor first",
        rows: [] as SegmentProbeRow[],
      };
    }
    const rows = probeSegmentsInTimeWindow(segments, t0, t1);
    // eslint-disable-next-line no-console -- dev-only
    console.info(`[segment-probe] ${t0}..${t1} → ${rows.length} row(s)`, rows);
    return { rows, count: rows.length };
  };
  Object.defineProperty(window, "__rushiSegmentProbe", {
    value: api,
    configurable: true,
    writable: true,
  });
}

declare global {
  interface Window {
    __rushiSegmentProbe?: (
      t0: number,
      t1: number,
    ) =>
      | { rows: SegmentProbeRow[]; count: number }
      | { error: string; rows: SegmentProbeRow[] };
  }
}
