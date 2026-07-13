import { describe, expect, it } from "vitest";
import {
  resolveWaveformCenterStatusLabel,
  resolveWaveformFooterStatusLabel,
  resolveWaveformHeaderStatusLabel,
} from "./waveformRenderStatus";

const base = {
  mountDeferTimedOut: false,
  waveformReady: true,
} as const;

describe("resolveWaveformFooterStatusLabel", () => {
  it("mirrors header steady-state labels for editor footer", () => {
    expect(resolveWaveformFooterStatusLabel({ ...base, phase: "decode" })).toBe("正在优化波形…");
  });

  it("returns null for idle waveform ready so footer can rotate shortcut hints", () => {
    expect(resolveWaveformFooterStatusLabel({ ...base, phase: "peaks" })).toBeNull();
  });

  it("surfaces peaksError in the footer", () => {
    expect(
      resolveWaveformFooterStatusLabel({
        ...base,
        phase: "unavailable",
        peaksError: "超时",
      }),
    ).toBe("波形生成失败：超时");
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

  it("shows generating in viewport while WaveSurfer is ready but peaks still decode", () => {
    expect(
      resolveWaveformCenterStatusLabel({
        ...base,
        phase: "decode",
        waveformReady: true,
      }),
    ).toBe("正在生成波形…");
  });

  it("shows loading before WaveSurfer is ready during decode", () => {
    expect(
      resolveWaveformCenterStatusLabel({
        ...base,
        phase: "decode",
        waveformReady: false,
      }),
    ).toBe("正在加载波形…");
  });

  it("shows peaksError in the viewport center (not off-screen timeline banner)", () => {
    expect(
      resolveWaveformCenterStatusLabel({
        ...base,
        phase: "unavailable",
        waveformReady: true,
        peaksError: "波形 peaks 生成未启动或已失败",
      }),
    ).toBe("波形生成失败：波形 peaks 生成未启动或已失败");
  });

  it("shows unavailable fallback when phase is unavailable without detail", () => {
    expect(
      resolveWaveformCenterStatusLabel({
        ...base,
        phase: "unavailable",
        waveformReady: false,
      }),
    ).toBe("波形生成失败");
  });
});
