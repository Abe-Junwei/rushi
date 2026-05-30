import { describe, expect, it } from "vitest";
import {
  resolveWaveformCenterStatusLabel,
  resolveWaveformFooterStatusLabel,
  resolveWaveformHeaderStatusLabel,
} from "./waveformRenderStatus";

const base = {
  backgroundPeaksEnabled: true,
  mountDeferTimedOut: false,
  waveformReady: true,
} as const;

describe("resolveWaveformFooterStatusLabel", () => {
  it("mirrors header steady-state labels for editor footer", () => {
    expect(resolveWaveformFooterStatusLabel({ ...base, phase: "decode" })).toBe("正在优化波形…");
  });
});

describe("resolveWaveformHeaderStatusLabel", () => {
  it("shows ready when peaks are applied", () => {
    expect(resolveWaveformHeaderStatusLabel({ ...base, phase: "peaks" })).toBe("波形就绪");
  });

  it("shows optimizing in header while decode waits for peaks", () => {
    expect(resolveWaveformHeaderStatusLabel({ ...base, phase: "decode" })).toBe("正在优化波形…");
  });
});

describe("resolveWaveformCenterStatusLabel", () => {
  it("shows generating in the waveform viewport", () => {
    expect(
      resolveWaveformCenterStatusLabel({
        ...base,
        phase: "generating",
        waveformReady: false,
      }),
    ).toBe("正在生成波形…");
  });

  it("hides generating copy when background peaks are disabled", () => {
    expect(
      resolveWaveformCenterStatusLabel({
        ...base,
        phase: "generating",
        backgroundPeaksEnabled: false,
        waveformReady: false,
      }),
    ).toBeNull();
  });

  it("shows loading after defer timeout before decode mount", () => {
    expect(
      resolveWaveformCenterStatusLabel({
        ...base,
        phase: "generating",
        mountDeferTimedOut: true,
        waveformReady: false,
      }),
    ).toBe("正在加载波形…");
  });
});
