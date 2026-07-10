/** Peaks-style seek entry — playhead sync runs inside {@link useWaveformPlayback.seek}
 * (Transport Authority `applyPeaksOrderedSeek`). Callers must not invoke `ws.setTime` directly. */

export type WaveformAtomicSeekTimeline = {
  wfApiRef: { current: { seek: (timeSec: number) => void } };
};

export function waveformAtomicSeek(timeline: WaveformAtomicSeekTimeline, timeSec: number): void {
  timeline.wfApiRef.current.seek(timeSec);
}
