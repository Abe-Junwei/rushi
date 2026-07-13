/** Coalesce tier-scroll-driven imperative paints into one rAF per frame. */

type TierScrollFrameSubscriber = () => void;

type PlaybackFrameSubscriber = {
  cb: (timeSec: number) => void;
  priority: number;
};

const subscribers = new Set<TierScrollFrameSubscriber>();
const playbackSubscribers: PlaybackFrameSubscriber[] = [];

function insertPlaybackSubscriber(entry: PlaybackFrameSubscriber): void {
  const insertAt = playbackSubscribers.findIndex((sub) => sub.priority > entry.priority);
  if (insertAt === -1) {
    playbackSubscribers.push(entry);
    return;
  }
  playbackSubscribers.splice(insertAt, 0, entry);
}
let frameRafId = 0;
let frameScheduled = false;
let coalescedScrollLeftPx: number | null = null;
let coalescedAtMs = 0;
let forceNextTierScrollFrame = false;
let pendingPlaybackTimeSec: number | null = null;
let pendingPlaybackScheduledAtMs: number | null = null;
let playbackTimeDuringFrame: number | null = null;

export type TierViewportMetricsSnapshot = {
  scrollLeftPx: number;
  viewportWidthPx: number;
};

let scrollFrameActive = false;
let scrollFrameMetricsSnapshot: TierViewportMetricsSnapshot | null = null;
let metricsSupplier: (() => TierViewportMetricsSnapshot | null) | null = null;

export function isTierScrollFrameActive(): boolean {
  return scrollFrameActive;
}

export function registerTierScrollFrameMetricsSupplier(
  supplier: (() => TierViewportMetricsSnapshot | null) | null,
): void {
  metricsSupplier = supplier;
}

export function writeTierViewportMetricsDuringScrollFrame(snapshot: TierViewportMetricsSnapshot): void {
  scrollFrameMetricsSnapshot = snapshot;
}

export function readTierViewportMetricsDuringScrollFrame(): TierViewportMetricsSnapshot | null {
  return scrollFrameMetricsSnapshot;
}

export function clearTierViewportMetricsDuringScrollFrameForTests(): void {
  scrollFrameMetricsSnapshot = null;
  scrollFrameActive = false;
  metricsSupplier = null;
  coalescedScrollLeftPx = null;
  coalescedAtMs = 0;
  forceNextTierScrollFrame = false;
  pendingPlaybackTimeSec = null;
  pendingPlaybackScheduledAtMs = null;
  playbackTimeDuringFrame = null;
}

import {
  isWaveformScrollProfileEnabled,
  waveformScrollProfileAudioScheduleCall,
  waveformScrollProfileBeginBurst,
  waveformScrollProfilePlaybackFrame,
} from "../services/waveform/waveformScrollProfile";
import { waveformFrameTimingTierSubscribers } from "../services/waveform/waveformFrameTimingProfile";

function runTierScrollFrame(): void {
  if (scrollFrameActive) return;
  frameScheduled = false;
  frameRafId = 0;
  scrollFrameActive = true;
  scrollFrameMetricsSnapshot = metricsSupplier?.() ?? null;
  const scrollLeftPx = scrollFrameMetricsSnapshot?.scrollLeftPx ?? null;
  const now = performance.now();
  const force = forceNextTierScrollFrame;
  forceNextTierScrollFrame = false;
  if (
    !force &&
    pendingPlaybackTimeSec == null &&
    scrollLeftPx != null &&
    scrollLeftPx === coalescedScrollLeftPx &&
    now - coalescedAtMs < 12
  ) {
    scrollFrameActive = false;
    scrollFrameMetricsSnapshot = null;
    return;
  }
  coalescedScrollLeftPx = scrollLeftPx;
  coalescedAtMs = now;
  const profileEnabled = isWaveformScrollProfileEnabled();
  waveformScrollProfileBeginBurst();
  if (pendingPlaybackTimeSec != null) {
    const playbackStartMs = profileEnabled ? performance.now() : 0;
    const frameLagMs =
      profileEnabled && pendingPlaybackScheduledAtMs != null
        ? playbackStartMs - pendingPlaybackScheduledAtMs
        : null;
    playbackTimeDuringFrame = pendingPlaybackTimeSec;
    for (const sub of playbackSubscribers) {
      sub.cb(pendingPlaybackTimeSec);
    }
    if (profileEnabled) {
      waveformScrollProfilePlaybackFrame({
        frameLagMs,
        subscriberMs: performance.now() - playbackStartMs,
      });
    }
    pendingPlaybackTimeSec = null;
    pendingPlaybackScheduledAtMs = null;
  }
  const tierSubscribersStartedAt = profileEnabled ? performance.now() : 0;
  for (const fn of subscribers) {
    fn();
  }
  if (tierSubscribersStartedAt > 0) {
    waveformFrameTimingTierSubscribers(performance.now() - tierSubscribersStartedAt);
  }
  playbackTimeDuringFrame = null;
  scrollFrameMetricsSnapshot = null;
  scrollFrameActive = false;
}

/** Schedule one coalesced scroll frame for viewport chrome paints. */
export function scheduleTierScrollFrame(): void {
  if (frameScheduled) return;
  frameScheduled = true;
  frameRafId = requestAnimationFrame(runTierScrollFrame);
}

export function subscribeTierScrollFrame(fn: TierScrollFrameSubscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Playback UI tick — same rAF as tier scroll chrome.
 * Playing: driven by useWaveformVisualPlayheadClock rAF media poll;
 * paused: driven by onWsAudioprocess or syncDisplayPlayheadAfterSeek. */
export function subscribePlaybackFrame(
  cb: (timeSec: number) => void,
  priority = 1,
): () => void {
  const entry: PlaybackFrameSubscriber = { cb, priority };
  insertPlaybackSubscriber(entry);
  return () => {
    const idx = playbackSubscribers.indexOf(entry);
    if (idx >= 0) playbackSubscribers.splice(idx, 1);
  };
}

/** Schedule one viewport frame: playback subscribers then scroll chrome (single rAF). */
export function schedulePlaybackViewportFrame(timeSec: number): void {
  const profileEnabled = isWaveformScrollProfileEnabled();
  if (profileEnabled) {
    waveformScrollProfileAudioScheduleCall();
  }
  pendingPlaybackTimeSec = timeSec;
  pendingPlaybackScheduledAtMs = profileEnabled ? performance.now() : null;
  scheduleTierScrollFrame();
}

/** Playback time for the current viewport frame (while subscribers run). */
export function readPlaybackTimeDuringViewportFrame(): number | null {
  return playbackTimeDuringFrame;
}

export type WaveformSegmentBandPaintOptions = {
  /** Bypass 12ms scroll-left coalesce (selection chrome, same-frame flush). */
  force?: boolean;
};

/** Request segment-band / scroll-chrome repaint (coalesced). */
export function requestWaveformSegmentBandPaint(options?: WaveformSegmentBandPaintOptions): void {
  if (options?.force) forceNextTierScrollFrame = true;
  scheduleTierScrollFrame();
}

/**
 * Run subscribers synchronously now, cancelling any pending rAF.
 * Use when an imperative scroll write must repaint sticky chrome in the SAME frame
 * (e.g. wheel-driven scroll), so sticky layers don't trail the natively-scrolled waveform by 1 frame.
 */
export function flushTierScrollFrame(options?: WaveformSegmentBandPaintOptions): void {
  // Programmatic scroll during an active viewport frame (e.g. playback follow) fires a
  // synchronous scroll event; flushing here would re-enter runTierScrollFrame while
  // pendingPlaybackTimeSec is still set and recurse until stack overflow.
  if (scrollFrameActive) return;
  if (options?.force) forceNextTierScrollFrame = true;
  if (frameRafId !== 0) {
    cancelAnimationFrame(frameRafId);
    frameRafId = 0;
  }
  frameScheduled = false;
  runTierScrollFrame();
}

/** Test-only: flush pending frame synchronously. */
export function flushTierScrollFrameForTests(): void {
  flushTierScrollFrame();
}

/** Test-only: clear subscribers and pending rAF. */
export function resetTierScrollFrameCoordinatorForTests(): void {
  if (frameRafId !== 0) {
    cancelAnimationFrame(frameRafId);
    frameRafId = 0;
  }
  frameScheduled = false;
  subscribers.clear();
  playbackSubscribers.length = 0;
  scrollFrameMetricsSnapshot = null;
  metricsSupplier = null;
  coalescedScrollLeftPx = null;
  coalescedAtMs = 0;
  forceNextTierScrollFrame = false;
  pendingPlaybackTimeSec = null;
  pendingPlaybackScheduledAtMs = null;
  playbackTimeDuringFrame = null;
}
