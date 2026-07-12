import { describe, expect, it } from "vitest";
import {
  shouldClearPlaybackSelectionDivert,
  shouldMarkPlaybackSelectionDivert,
  shouldRevealTranscriptPlaybackFocus,
} from "./transcriptPlaybackFocus";

describe("transcriptPlaybackFocus", () => {
  it("reveals only when focus index advances while playing and unsuppressed", () => {
    expect(
      shouldRevealTranscriptPlaybackFocus({
        enabled: true,
        isPlaying: true,
        focusIdx: 2,
        prevFocusIdx: 1,
        editorFocused: false,
        userScrollSuppressUntilMs: 0,
        nowMs: 100,
        selectionDiverted: false,
      }),
    ).toBe(true);
  });

  it("does not reveal on the first playback focus frame", () => {
    expect(
      shouldRevealTranscriptPlaybackFocus({
        enabled: true,
        isPlaying: true,
        focusIdx: 2,
        prevFocusIdx: -1,
        editorFocused: false,
        userScrollSuppressUntilMs: 0,
        nowMs: 100,
        selectionDiverted: false,
      }),
    ).toBe(false);
  });

  it("does not reveal when scrolling, diverted, or unchanged (focus alone does not block)", () => {
    const base = {
      enabled: true,
      isPlaying: true,
      focusIdx: 2,
      prevFocusIdx: 1,
      editorFocused: false,
      userScrollSuppressUntilMs: 0,
      nowMs: 100,
      selectionDiverted: false,
    };
    expect(shouldRevealTranscriptPlaybackFocus({ ...base, editorFocused: true })).toBe(true);
    expect(
      shouldRevealTranscriptPlaybackFocus({
        ...base,
        userScrollSuppressUntilMs: 200,
        nowMs: 100,
      }),
    ).toBe(false);
    expect(shouldRevealTranscriptPlaybackFocus({ ...base, selectionDiverted: true })).toBe(false);
    expect(shouldRevealTranscriptPlaybackFocus({ ...base, prevFocusIdx: 2 })).toBe(false);
    expect(shouldRevealTranscriptPlaybackFocus({ ...base, enabled: false })).toBe(false);
    expect(shouldRevealTranscriptPlaybackFocus({ ...base, isPlaying: false })).toBe(false);
    expect(shouldRevealTranscriptPlaybackFocus({ ...base, focusIdx: -1 })).toBe(false);
  });

  it("marks divert when selecting away from playback focus while playing", () => {
    expect(
      shouldMarkPlaybackSelectionDivert({
        isPlaying: true,
        selectedIdx: 9,
        focusIdx: 2,
      }),
    ).toBe(true);
    expect(
      shouldMarkPlaybackSelectionDivert({
        isPlaying: true,
        selectedIdx: 2,
        focusIdx: 2,
      }),
    ).toBe(false);
    expect(
      shouldMarkPlaybackSelectionDivert({
        isPlaying: false,
        selectedIdx: 9,
        focusIdx: 2,
      }),
    ).toBe(false);
  });

  it("clears divert on pause or re-align", () => {
    expect(
      shouldClearPlaybackSelectionDivert({
        isPlaying: false,
        selectionDiverted: true,
        primaryIdx: 9,
        focusIdx: 2,
      }),
    ).toBe(true);
    expect(
      shouldClearPlaybackSelectionDivert({
        isPlaying: true,
        selectionDiverted: true,
        primaryIdx: 2,
        focusIdx: 2,
      }),
    ).toBe(true);
    expect(
      shouldClearPlaybackSelectionDivert({
        isPlaying: true,
        selectionDiverted: true,
        primaryIdx: 9,
        focusIdx: 2,
      }),
    ).toBe(false);
  });
});
