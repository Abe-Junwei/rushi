export type WaveformRulerView = {
  start: number;
  end: number;
};

export function resolveWaveformRulerView(input: {
  durationSec: number;
  scrollLeftPx: number;
  clientWidthPx: number;
  pxPerSec: number;
}): WaveformRulerView | null {
  const dur = Math.max(0, input.durationSec);
  const pxPerSec = Math.max(input.pxPerSec, 1e-6);
  if (dur <= 0) return null;
  const clientWidth = Math.max(1, input.clientWidthPx);
  const totalWidth = Math.max(clientWidth, Math.ceil(dur * pxPerSec));
  const start = (Math.max(0, input.scrollLeftPx) / totalWidth) * dur;
  const end = ((Math.max(0, input.scrollLeftPx) + clientWidth) / totalWidth) * dur;
  return {
    start: Math.max(0, Math.min(start, dur)),
    end: Math.max(0, Math.min(end, dur)),
  };
}
