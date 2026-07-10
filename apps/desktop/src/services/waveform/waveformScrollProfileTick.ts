import type { WaveformFrameTimingSnapshot } from "./waveformFrameTimingProfile";
import type { ScrollProfileCounters } from "./waveformScrollProfile";

const average = (sum: number, count: number) => (count > 0 ? sum / count : 0);

export function formatWaveformScrollProfileTick(input: {
  elapsedMs: number;
  counters: ScrollProfileCounters;
  timings: WaveformFrameTimingSnapshot;
}): string | null {
  const { counters, timings } = input;
  if (
    counters.audioTicks === 0 &&
    counters.playbackFrames === 0 &&
    counters.tierFrames === 0 &&
    counters.rulerRepaint === 0 &&
    counters.bandRepaint === 0
  ) {
    return null;
  }
  const audioDelta = average(counters.audioDeltaSumMs, counters.audioDeltaSamples);
  const audioHandler = average(counters.audioHandlerSumMs, counters.audioTicks);
  const frameLag = average(counters.playbackFrameLagSumMs, counters.playbackFrames);
  const playbackSub = average(counters.playbackSubscriberSumMs, counters.playbackFrames);
  const tierSub = average(timings.tierSubscribers.sumMs, timings.tierSubscribers.count);
  const rulerPaint = average(timings.rulerPaint.sumMs, timings.rulerPaint.count);
  const bandPaint = average(timings.bandPaint.sumMs, timings.bandPaint.count);
  return `[scroll-profile] tick ${input.elapsedMs.toFixed(0)}ms · audioTicks=${counters.audioTicks} audioDelta=${audioDelta.toFixed(1)}/${counters.audioDeltaMaxMs.toFixed(1)}ms audioHandler=${audioHandler.toFixed(2)}/${counters.audioHandlerMaxMs.toFixed(2)}ms schedules=${counters.audioScheduleCalls} · playbackFrames=${counters.playbackFrames} frameLag=${frameLag.toFixed(1)}/${counters.playbackFrameLagMaxMs.toFixed(1)}ms playbackSub=${playbackSub.toFixed(2)}/${counters.playbackSubscriberMaxMs.toFixed(2)}ms tierSub=${tierSub.toFixed(2)}/${timings.tierSubscribers.maxMs.toFixed(2)}ms · rulerRepaint=${counters.rulerRepaint} rulerPaint=${rulerPaint.toFixed(2)}/${timings.rulerPaint.maxMs.toFixed(2)}ms · bandRepaint=${counters.bandRepaint} bandPaint=${bandPaint.toFixed(2)}/${timings.bandPaint.maxMs.toFixed(2)}ms · minimapVp=${counters.minimapViewportWrites} · tierFrames=${counters.tierFrames}`;
}
