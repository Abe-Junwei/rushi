type BurstCounters = {
  tierFrames: number;
  bandSkipped: number;
  bandRepaint: number;
  bandLeftWrites: number;
  rulerSkipped: number;
  rulerRepaint: number;
  rulerLeftWrites: number;
  minimapWrites: number;
};

let active = false;
let startedAtMs = 0;
const counts: BurstCounters = {
  tierFrames: 0,
  bandSkipped: 0,
  bandRepaint: 0,
  bandLeftWrites: 0,
  rulerSkipped: 0,
  rulerRepaint: 0,
  rulerLeftWrites: 0,
  minimapWrites: 0,
};

export function waveformScrollBurstBegin(nowMs: number): void {
  if (!active) {
    active = true;
    startedAtMs = nowMs;
  }
  counts.tierFrames += 1;
}

export function waveformScrollBurstBandSkipped(): void {
  counts.bandSkipped += 1;
}

export function waveformScrollBurstBandRepaint(leftWrite: boolean): void {
  counts.bandRepaint += 1;
  if (leftWrite) counts.bandLeftWrites += 1;
}

export function waveformScrollBurstRulerSkipped(leftWrite: boolean): void {
  counts.rulerSkipped += 1;
  if (leftWrite) counts.rulerLeftWrites += 1;
}

export function waveformScrollBurstRulerRepaint(leftWrite: boolean): void {
  counts.rulerRepaint += 1;
  if (leftWrite) counts.rulerLeftWrites += 1;
}

export function waveformScrollBurstMinimapWrite(): void {
  counts.minimapWrites += 1;
}

export function flushWaveformScrollBurst(nowMs: number): string | null {
  if (!active || nowMs - startedAtMs < 120) return null;
  const elapsedMs = nowMs - startedAtMs;
  const bandSkipPct =
    counts.tierFrames > 0 ? Math.round((counts.bandSkipped / counts.tierFrames) * 100) : 0;
  const rulerSkipPct =
    counts.tierFrames > 0 ? Math.round((counts.rulerSkipped / counts.tierFrames) * 100) : 0;
  const line = `[scroll-profile] burst ${elapsedMs.toFixed(0)}ms · frames=${counts.tierFrames} · band skip=${counts.bandSkipped} (${bandSkipPct}%) repaint=${counts.bandRepaint} cspLeft=${counts.bandLeftWrites} · ruler skip=${counts.rulerSkipped} (${rulerSkipPct}%) repaint=${counts.rulerRepaint} cspLeft=${counts.rulerLeftWrites} · minimapVp=${counts.minimapWrites}`;
  resetWaveformScrollBurstProfile();
  return line;
}

export function resetWaveformScrollBurstProfile(): void {
  active = false;
  startedAtMs = 0;
  for (const key of Object.keys(counts) as Array<keyof BurstCounters>) counts[key] = 0;
}
