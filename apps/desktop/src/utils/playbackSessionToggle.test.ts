import { describe, expect, it } from "vitest";
import {
  resolveGlobalTogglePlay,
  resolveSessionTogglePlay,
} from "./playbackSessionToggle";

describe("resolveSessionTogglePlay (Space sticky)", () => {
  it("playing → pause keeping session", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: true,
        session: { kind: "segment", idx: 2 },
      }),
    ).toEqual({ action: "pauseKeepingSession" });
  });

  it("paused segment session → resume that idx", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 4 },
      }),
    ).toEqual({ action: "resumeSegment", idx: 4 });
  });

  it("paused segment session + different selected segment → resume selected segment", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 4 },
        segmentStillExists: true,
        selectedSegmentIdx: 2,
      }),
    ).toEqual({ action: "resumeSegment", idx: 2 });
  });

  it("paused segment session + same selected segment → keep sticky session", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 4 },
        segmentStillExists: true,
        selectedSegmentIdx: 4,
      }),
    ).toEqual({ action: "resumeSegment", idx: 4 });
  });

  it("paused after natural end still resumes segment (session sticky)", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 1 },
        segmentStillExists: true,
      }),
    ).toEqual({ action: "resumeSegment", idx: 1 });
  });

  it("stale segment idx → fall through to selected segment when present", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 99 },
        segmentStillExists: false,
        selectedSegmentIdx: 2,
      }),
    ).toEqual({ action: "resumeSegment", idx: 2 });
  });

  it("stale segment idx with no selection → start global", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 99 },
        segmentStillExists: false,
      }),
    ).toEqual({ action: "startGlobal" });
  });

  it("idle null session with selection → start segment play", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: null,
        selectedSegmentIdx: 3,
      }),
    ).toEqual({ action: "resumeSegment", idx: 3 });
  });

  it("paused sticky global session with selection → resume global from playhead", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "global" },
        selectedSegmentIdx: 1,
      }),
    ).toEqual({ action: "startGlobal" });
  });

  it("blank seek arms preferGlobalSpace → start global even with selection", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "global" },
        selectedSegmentIdx: 1,
        preferGlobalSpace: true,
      }),
    ).toEqual({ action: "startGlobal" });
  });

  it("after clearing preferGlobalSpace with null session, selection resumes segment play", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: null,
        selectedSegmentIdx: 1,
        preferGlobalSpace: false,
      }),
    ).toEqual({ action: "resumeSegment", idx: 1 });
  });

  it("after clearing preferGlobalSpace, sticky global still resumes global", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "global" },
        selectedSegmentIdx: 1,
        preferGlobalSpace: false,
      }),
    ).toEqual({ action: "startGlobal" });
  });

  it("preferGlobalSpace does not override sticky segment session", () => {
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 4 },
        selectedSegmentIdx: 4,
        preferGlobalSpace: true,
      }),
    ).toEqual({ action: "resumeSegment", idx: 4 });
  });

  it("idle / global session without selection → start global", () => {
    expect(
      resolveSessionTogglePlay({ isPlaying: false, session: null }),
    ).toEqual({ action: "startGlobal" });
    expect(
      resolveSessionTogglePlay({
        isPlaying: false,
        session: { kind: "global" },
      }),
    ).toEqual({ action: "startGlobal" });
  });
});

describe("resolveGlobalTogglePlay (toolbar)", () => {
  it("segment playing → exit hatch without pause", () => {
    expect(
      resolveGlobalTogglePlay({
        isPlaying: true,
        session: { kind: "segment", idx: 0 },
      }),
    ).toEqual({ action: "exitSegmentToGlobal" });
  });

  it("global playing → pause", () => {
    expect(
      resolveGlobalTogglePlay({
        isPlaying: true,
        session: { kind: "global" },
      }),
    ).toEqual({ action: "pauseKeepingSession" });
  });

  it("paused → start global", () => {
    expect(
      resolveGlobalTogglePlay({
        isPlaying: false,
        session: { kind: "segment", idx: 0 },
      }),
    ).toEqual({ action: "startGlobal" });
  });
});
