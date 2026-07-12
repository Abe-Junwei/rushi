import { describe, expect, it } from "vitest";
import { resolveWaveformPlayheadChromeMode } from "./waveformPlayheadChrome";

describe("resolveWaveformPlayheadChromeMode", () => {
  it("idle null session → segment (default chrome)", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: null,
        isPlaying: false,
        isSelectedSegmentPlaying: false,
      }),
    ).toBe("segment");
  });

  it("segment sticky session → segment", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: { kind: "segment", idx: 2 },
        isPlaying: false,
        isSelectedSegmentPlaying: false,
      }),
    ).toBe("segment");
  });

  it("scoped playing → segment even if session missing", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: null,
        isPlaying: true,
        isSelectedSegmentPlaying: true,
      }),
    ).toBe("segment");
  });

  it("idle global session → segment chrome (Space will honor selection)", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: { kind: "global" },
        isPlaying: false,
        isSelectedSegmentPlaying: false,
      }),
    ).toBe("segment");
  });

  it("blank seek preferGlobalSpace → global", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: null,
        isPlaying: false,
        isSelectedSegmentPlaying: false,
        preferGlobalSpace: true,
      }),
    ).toBe("global");
  });

  it("idle global session + preferGlobalSpace → global", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: { kind: "global" },
        isPlaying: false,
        isSelectedSegmentPlaying: false,
        preferGlobalSpace: true,
      }),
    ).toBe("global");
  });

  it("playing without scoped → global", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: null,
        isPlaying: true,
        isSelectedSegmentPlaying: false,
      }),
    ).toBe("global");
  });

  it("segment sticky wins over preferGlobalSpace", () => {
    expect(
      resolveWaveformPlayheadChromeMode({
        session: { kind: "segment", idx: 0 },
        isPlaying: false,
        isSelectedSegmentPlaying: false,
        preferGlobalSpace: true,
      }),
    ).toBe("segment");
  });
});
