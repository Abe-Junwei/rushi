import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetWaveformScrollProfileForTests,
  waveformScrollProfileAudioProcess,
  waveformScrollProfileAudioScheduleCall,
  waveformScrollProfileBandSkipped,
  waveformScrollProfileBeginBurst,
  waveformScrollProfileMaybeFlushBurst,
  waveformScrollProfilePlaybackFrame,
} from "./waveformScrollProfile";
import { installWaveformScrollProfileDevTools } from "./waveformScrollProfileDevTools";
import {
  waveformFrameTimingBandPaint,
  waveformFrameTimingRulerPaint,
  waveformFrameTimingTierSubscribers,
} from "./waveformFrameTimingProfile";

describe("waveformScrollProfile", () => {
  afterEach(() => {
    resetWaveformScrollProfileForTests();
    vi.useRealTimers();
  });

  it("counts band skip ratio in burst summary", () => {
    vi.useFakeTimers();
    installWaveformScrollProfileDevTools();
    const on = window.__rushiScrollProfile?.enable();
    expect(on?.enabled).toBe(true);
    expect(on?.message).toContain("enabled");
    waveformScrollProfileBeginBurst();
    waveformScrollProfileBandSkipped();
    waveformScrollProfileBeginBurst();
    vi.advanceTimersByTime(121);
    waveformScrollProfileMaybeFlushBurst();
    expect(window.__rushiScrollProfile?.recent().some((line) => line.includes("band skip=1 (50%)"))).toBe(true);
    expect(window.__rushiScrollProfile?.counters().bandSkipped).toBe(1);
  });

  it("ignores probe counters while disabled", () => {
    waveformScrollProfileAudioProcess({ deltaMs: 20, handlerMs: 1 });
    waveformScrollProfileAudioScheduleCall();
    waveformScrollProfilePlaybackFrame({ frameLagMs: 2, subscriberMs: 3 });

    installWaveformScrollProfileDevTools();
    expect(window.__rushiScrollProfile?.counters().audioTicks).toBe(0);
    expect(window.__rushiScrollProfile?.counters().playbackFrames).toBe(0);
  });

  it("records audioprocess and viewport-frame probe counters while enabled", () => {
    installWaveformScrollProfileDevTools();
    window.__rushiScrollProfile?.enable();

    waveformScrollProfileAudioScheduleCall();
    waveformScrollProfileAudioProcess({ deltaMs: null, handlerMs: 0.4 });
    waveformScrollProfileAudioProcess({ deltaMs: 16, handlerMs: 0.8 });
    waveformScrollProfileAudioProcess({ deltaMs: 40, handlerMs: 0.2 });
    waveformScrollProfilePlaybackFrame({ frameLagMs: 5, subscriberMs: 1.5 });
    waveformScrollProfilePlaybackFrame({ frameLagMs: 9, subscriberMs: 2.5 });

    const counters = window.__rushiScrollProfile?.counters();
    expect(counters?.audioTicks).toBe(3);
    expect(counters?.audioDeltaMaxMs).toBe(40);
    expect(counters?.audioHandlerMaxMs).toBe(0.8);
    expect(counters?.audioScheduleCalls).toBe(1);
    expect(counters?.playbackFrames).toBe(2);
    expect(counters?.playbackFrameLagMaxMs).toBe(9);
    expect(counters?.playbackSubscriberMaxMs).toBe(2.5);
  });

  it("auto-flushes probe counters into recent lines and resets them", () => {
    vi.useFakeTimers();
    installWaveformScrollProfileDevTools();
    window.__rushiScrollProfile?.enable();

    waveformScrollProfileAudioScheduleCall();
    waveformScrollProfileAudioProcess({ deltaMs: null, handlerMs: 0.5 });
    waveformScrollProfileAudioProcess({ deltaMs: 25, handlerMs: 1 });
    waveformScrollProfilePlaybackFrame({ frameLagMs: 4, subscriberMs: 2 });
    waveformFrameTimingTierSubscribers(8);
    waveformFrameTimingRulerPaint(3);
    waveformFrameTimingBandPaint(5);

    vi.advanceTimersByTime(1000);

    const recent = window.__rushiScrollProfile?.recent() ?? [];
    const line = recent[recent.length - 1] ?? "";
    expect(line).toContain("tick 1000ms");
    expect(line).toContain("audioTicks=2");
    expect(line).toContain("audioDelta=25.0/25.0ms");
    expect(line).toContain("playbackFrames=1");
    expect(line).toContain("tierSub=8.00/8.00ms");
    expect(line).toContain("rulerPaint=3.00/3.00ms");
    expect(line).toContain("bandPaint=5.00/5.00ms");
    expect(window.__rushiScrollProfile?.counters().audioTicks).toBe(0);
    expect(window.__rushiScrollProfile?.counters().playbackFrames).toBe(0);
  });
});
