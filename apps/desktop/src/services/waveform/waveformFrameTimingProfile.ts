type TimingBucket = {
  count: number;
  sumMs: number;
  maxMs: number;
};

export type WaveformFrameTimingSnapshot = {
  tierSubscribers: TimingBucket;
  bandPaint: TimingBucket;
  rulerPaint: TimingBucket;
};

const createBucket = (): TimingBucket => ({ count: 0, sumMs: 0, maxMs: 0 });

const timings: WaveformFrameTimingSnapshot = {
  tierSubscribers: createBucket(),
  bandPaint: createBucket(),
  rulerPaint: createBucket(),
};

function record(bucket: TimingBucket, durationMs: number): void {
  bucket.count += 1;
  bucket.sumMs += durationMs;
  bucket.maxMs = Math.max(bucket.maxMs, durationMs);
}

export function waveformFrameTimingTierSubscribers(durationMs: number): void {
  record(timings.tierSubscribers, durationMs);
}

export function waveformFrameTimingBandPaint(durationMs: number): void {
  record(timings.bandPaint, durationMs);
}

export function waveformFrameTimingRulerPaint(durationMs: number): void {
  record(timings.rulerPaint, durationMs);
}

export function takeWaveformFrameTimingSnapshot(): WaveformFrameTimingSnapshot {
  const snapshot = {
    tierSubscribers: { ...timings.tierSubscribers },
    bandPaint: { ...timings.bandPaint },
    rulerPaint: { ...timings.rulerPaint },
  };
  resetWaveformFrameTimingProfile();
  return snapshot;
}

export function resetWaveformFrameTimingProfile(): void {
  for (const bucket of Object.values(timings)) {
    bucket.count = 0;
    bucket.sumMs = 0;
    bucket.maxMs = 0;
  }
}
