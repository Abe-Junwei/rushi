import { logDesktopUi } from "../desktopUiLog";
import {
  resetWaveformFrameTimingProfile,
  takeWaveformFrameTimingSnapshot,
} from "./waveformFrameTimingProfile";
import {
  flushWaveformScrollBurst,
  resetWaveformScrollBurstProfile,
  waveformScrollBurstBandRepaint,
  waveformScrollBurstBandSkipped,
  waveformScrollBurstBegin,
  waveformScrollBurstMinimapWrite,
  waveformScrollBurstRulerRepaint,
  waveformScrollBurstRulerSkipped,
} from "./waveformScrollBurstProfile";
import { formatWaveformScrollProfileTick } from "./waveformScrollProfileTick";

export const WAVEFORM_SCROLL_PROFILE_STORAGE_KEY = "rushi.dev.waveformScrollProfile";

const RECENT_LINES_MAX = 48;
const AUTO_TICK_INTERVAL_MS = 1000;

export type ScrollProfileCounters = {
  audioTicks: number;
  audioDeltaSamples: number;
  audioDeltaSumMs: number;
  audioDeltaMaxMs: number;
  audioHandlerSumMs: number;
  audioHandlerMaxMs: number;
  audioScheduleCalls: number;
  tierFrames: number;
  playbackFrames: number;
  playbackFrameLagSumMs: number;
  playbackFrameLagMaxMs: number;
  playbackSubscriberSumMs: number;
  playbackSubscriberMaxMs: number;
  bandSkipped: number;
  bandRepaint: number;
  bandCspLeftWrites: number;
  minimapViewportWrites: number;
  rulerSkipped: number;
  rulerRepaint: number;
  rulerCspLeftWrites: number;
};

let enabled = false;
let enabledResolved = false;
let autoTickId: ReturnType<typeof setInterval> | null = null;
let autoTickStartedAtMs = 0;
const counters: ScrollProfileCounters = {
  audioTicks: 0,
  audioDeltaSamples: 0,
  audioDeltaSumMs: 0,
  audioDeltaMaxMs: 0,
  audioHandlerSumMs: 0,
  audioHandlerMaxMs: 0,
  audioScheduleCalls: 0,
  tierFrames: 0,
  playbackFrames: 0,
  playbackFrameLagSumMs: 0,
  playbackFrameLagMaxMs: 0,
  playbackSubscriberSumMs: 0,
  playbackSubscriberMaxMs: 0,
  bandSkipped: 0,
  bandRepaint: 0,
  bandCspLeftWrites: 0,
  minimapViewportWrites: 0,
  rulerSkipped: 0,
  rulerRepaint: 0,
  rulerCspLeftWrites: 0,
};
const recentLines: string[] = [];

function resetIntervalCounters(): void {
  for (const key of Object.keys(counters) as Array<keyof ScrollProfileCounters>) counters[key] = 0;
}

export function emitWaveformScrollProfileLine(line: string): void {
  recentLines.push(line);
  if (recentLines.length > RECENT_LINES_MAX) recentLines.shift();
  if (typeof console !== "undefined" && typeof console.info === "function") {
    // eslint-disable-next-line no-console -- dev-only scroll profile
    console.info(line);
  }
  logDesktopUi("INFO", line);
}

export function isWaveformScrollProfileEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledResolved) return enabled;
  try {
    enabled = window.localStorage.getItem(WAVEFORM_SCROLL_PROFILE_STORAGE_KEY) === "1";
  } catch {
    enabled = false;
  }
  enabledResolved = true;
  return enabled;
}

export function setWaveformScrollProfileEnabled(next: boolean): void {
  enabled = next;
  enabledResolved = true;
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(WAVEFORM_SCROLL_PROFILE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(WAVEFORM_SCROLL_PROFILE_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function resetWaveformScrollProfileCounters(): void {
  resetIntervalCounters();
  autoTickStartedAtMs = performance.now();
  resetWaveformFrameTimingProfile();
  resetWaveformScrollBurstProfile();
}

export function waveformScrollProfileAudioProcess(input: {
  deltaMs: number | null;
  handlerMs: number;
}): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.audioTicks += 1;
  if (input.deltaMs != null) {
    counters.audioDeltaSamples += 1;
    counters.audioDeltaSumMs += input.deltaMs;
    counters.audioDeltaMaxMs = Math.max(counters.audioDeltaMaxMs, input.deltaMs);
  }
  counters.audioHandlerSumMs += input.handlerMs;
  counters.audioHandlerMaxMs = Math.max(counters.audioHandlerMaxMs, input.handlerMs);
}

export function waveformScrollProfileAudioScheduleCall(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.audioScheduleCalls += 1;
}

export function waveformScrollProfilePlaybackFrame(input?: {
  frameLagMs?: number | null;
  subscriberMs?: number;
}): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.playbackFrames += 1;
  if (input?.frameLagMs != null) {
    counters.playbackFrameLagSumMs += input.frameLagMs;
    counters.playbackFrameLagMaxMs = Math.max(counters.playbackFrameLagMaxMs, input.frameLagMs);
  }
  if (input?.subscriberMs != null) {
    counters.playbackSubscriberSumMs += input.subscriberMs;
    counters.playbackSubscriberMaxMs = Math.max(counters.playbackSubscriberMaxMs, input.subscriberMs);
  }
}

function autoTickFlush(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  const now = performance.now();
  const elapsedMs = Math.max(1, now - autoTickStartedAtMs);
  autoTickStartedAtMs = now;
  const frameTimings = takeWaveformFrameTimingSnapshot();
  const line = formatWaveformScrollProfileTick({ elapsedMs, counters, timings: frameTimings });
  if (!line) return;
  emitWaveformScrollProfileLine(line);
  resetIntervalCounters();
}

export function startWaveformScrollProfileAutoTick(): void {
  if (autoTickId != null || typeof setInterval === "undefined") return;
  autoTickStartedAtMs = performance.now();
  autoTickId = setInterval(autoTickFlush, AUTO_TICK_INTERVAL_MS);
}

export function stopWaveformScrollProfileAutoTick(): void {
  if (autoTickId == null) return;
  clearInterval(autoTickId);
  autoTickId = null;
}

export function waveformScrollProfileBeginBurst(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  waveformScrollBurstBegin(performance.now());
  counters.tierFrames += 1;
}

export function waveformScrollProfileBandSkipped(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.bandSkipped += 1;
  waveformScrollBurstBandSkipped();
}

export function waveformScrollProfileBandRepaint(cspLeftWrite: boolean): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.bandRepaint += 1;
  if (cspLeftWrite) counters.bandCspLeftWrites += 1;
  waveformScrollBurstBandRepaint(cspLeftWrite);
}

export function waveformScrollProfileMinimapViewportWrite(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.minimapViewportWrites += 1;
  waveformScrollBurstMinimapWrite();
}

export function waveformScrollProfileRulerSkipped(cspLeftWrite: boolean): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.rulerSkipped += 1;
  if (cspLeftWrite) counters.rulerCspLeftWrites += 1;
  waveformScrollBurstRulerSkipped(cspLeftWrite);
}

export function waveformScrollProfileRulerRepaint(cspLeftWrite: boolean): void {
  if (!isWaveformScrollProfileEnabled()) return;
  counters.rulerRepaint += 1;
  if (cspLeftWrite) counters.rulerCspLeftWrites += 1;
  waveformScrollBurstRulerRepaint(cspLeftWrite);
}

export function waveformScrollProfileMaybeFlushBurst(): void {
  if (!isWaveformScrollProfileEnabled()) return;
  const line = flushWaveformScrollBurst(performance.now());
  if (line) emitWaveformScrollProfileLine(line);
}

export function readWaveformScrollProfileCounters(): ScrollProfileCounters {
  return { ...counters };
}

export function readWaveformScrollProfileRecentLines(): string[] {
  return [...recentLines];
}

export function resetWaveformScrollProfileForTests(): void {
  stopWaveformScrollProfileAutoTick();
  setWaveformScrollProfileEnabled(false);
  resetWaveformScrollProfileCounters();
  recentLines.length = 0;
}
