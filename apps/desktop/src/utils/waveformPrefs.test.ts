import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clampPxPerSec } from "./pxPerSec";
import {
  migrateLegacySegmentPlaybackRateToGlobal,
  readStoredNativeAudioPlaybackEnabled,
  readStoredWaveformGlobalPlaybackRate,
  readStoredWaveformHeightPx,
  readStoredWaveformPxPerSec,
  WAVEFORM_HEIGHT_DEFAULT,
  writeStoredNativeAudioPlaybackEnabled,
  writeStoredWaveformHeightPx,
  writeStoredWaveformPxPerSec,
  subscribeWaveformPrefs,
  writeStoredTabAdvanceLoopsSegment,
  readStoredTabAdvanceLoopsSegment,
  readStoredTranscriptPlaybackFollow,
  writeStoredTranscriptPlaybackFollow,
} from "./waveformPrefs";

describe("waveformPrefs localStorage", () => {
  const mem: Record<string, string> = {};
  const sessionMem: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) =>
        Object.prototype.hasOwnProperty.call(sessionMem, k) ? sessionMem[k] : null,
      setItem: (k: string, v: string) => {
        sessionMem[k] = v;
      },
      removeItem: (k: string) => {
        delete sessionMem[k];
      },
      clear: () => {
        for (const k of Object.keys(sessionMem)) delete sessionMem[k];
      },
      key: () => null,
      length: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(mem)) delete mem[k];
    for (const k of Object.keys(sessionMem)) delete sessionMem[k];
  });

  it("round-trips px/s after clamp", () => {
    writeStoredWaveformPxPerSec(120);
    expect(readStoredWaveformPxPerSec()).toBe(120);
  });

  it("clamps invalid stored values on read", () => {
    localStorage.setItem("rushi.p1.waveformPxPerSec", "99999");
    expect(readStoredWaveformPxPerSec()).toBe(clampPxPerSec(99999));
  });

  it("ignores legacy default waveform height so product default applies", () => {
    localStorage.setItem("rushi.p1.waveformHeightPx", "96");
    expect(readStoredWaveformHeightPx()).toBeNull();
  });

  it("round-trips waveform height after clamp", () => {
    writeStoredWaveformHeightPx(WAVEFORM_HEIGHT_DEFAULT);
    expect(readStoredWaveformHeightPx()).toBe(WAVEFORM_HEIGHT_DEFAULT);
  });

  it("defaults tab-advance loop playback to off", () => {
    localStorage.removeItem("rushi.p1.tabAdvanceLoopsSegment");
    expect(readStoredTabAdvanceLoopsSegment()).toBe(false);
    writeStoredTabAdvanceLoopsSegment(true);
    expect(readStoredTabAdvanceLoopsSegment()).toBe(true);
    writeStoredTabAdvanceLoopsSegment(false);
    expect(readStoredTabAdvanceLoopsSegment()).toBe(false);
  });

  it("notifies subscribers when editor prefs change", () => {
    let calls = 0;
    const unsub = subscribeWaveformPrefs(() => {
      calls += 1;
    });
    writeStoredTabAdvanceLoopsSegment(false);
    expect(calls).toBe(1);
    unsub();
  });

  it("defaults transcript playback follow to on and round-trips off", () => {
    expect(readStoredTranscriptPlaybackFollow()).toBe(true);
    writeStoredTranscriptPlaybackFollow(false);
    expect(readStoredTranscriptPlaybackFollow()).toBe(false);
    writeStoredTranscriptPlaybackFollow(true);
    expect(readStoredTranscriptPlaybackFollow()).toBe(true);
  });

  it("migrates legacy segment playback rate into global when global is default", () => {
    localStorage.setItem("rushi.p1.segmentPlaybackRate", "1.5");
    expect(migrateLegacySegmentPlaybackRateToGlobal()).toBe(1.5);
    expect(readStoredWaveformGlobalPlaybackRate()).toBe(1.5);
    expect(localStorage.getItem("rushi.p1.segmentPlaybackRate")).toBeNull();
  });

  it("drops legacy segment key without overwriting explicit global rate", () => {
    localStorage.setItem("rushi.p1.waveformGlobalPlaybackRate", "2");
    localStorage.setItem("rushi.p1.segmentPlaybackRate", "1.5");
    expect(migrateLegacySegmentPlaybackRateToGlobal()).toBeNull();
    expect(readStoredWaveformGlobalPlaybackRate()).toBe(2);
    expect(localStorage.getItem("rushi.p1.segmentPlaybackRate")).toBeNull();
  });

  it("native audio playback is mandatory (always enabled)", () => {
    expect(readStoredNativeAudioPlaybackEnabled()).toBe(true);
    writeStoredNativeAudioPlaybackEnabled(false);
    expect(readStoredNativeAudioPlaybackEnabled()).toBe(true);
  });
});
