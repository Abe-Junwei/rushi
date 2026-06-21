import { afterEach, describe, expect, it } from "vitest";
import {
  installWaveformScrollProfileDevTools,
  resetWaveformScrollProfileForTests,
  waveformScrollProfileBandSkipped,
  waveformScrollProfileBeginBurst,
  waveformScrollProfileMaybeFlushBurst,
} from "./waveformScrollProfile";

describe("waveformScrollProfile", () => {
  afterEach(() => {
    resetWaveformScrollProfileForTests();
  });

  it("counts band skip ratio in burst summary", () => {
    installWaveformScrollProfileDevTools();
    const on = window.__rushiScrollProfile?.enable();
    expect(on?.enabled).toBe(true);
    expect(on?.message).toContain("enabled");
    waveformScrollProfileBeginBurst();
    waveformScrollProfileBandSkipped();
    waveformScrollProfileBeginBurst();
    waveformScrollProfileMaybeFlushBurst();
    expect(window.__rushiScrollProfile?.counters().bandSkipped).toBe(1);
  });
});
