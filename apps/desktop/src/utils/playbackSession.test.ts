/**
 * Sticky Space vs toolbar「全局播放」— session model for global ↔ segment transport.
 *
 * Research: [`global-segment-playback-cross-switch-research.md`](./global-segment-playback-cross-switch-research.md) §4（2026-07-12 会话粘性签收）
 */

import { describe, expect, it } from "vitest";
import {
  isGlobalPlaybackSession,
  isSegmentPlaybackSession,
  type PlaybackSession,
} from "./playbackSession";

describe("playbackSession", () => {
  it("narrows segment vs global", () => {
    const segment: PlaybackSession = { kind: "segment", idx: 3 };
    const global: PlaybackSession = { kind: "global" };
    expect(isSegmentPlaybackSession(segment)).toBe(true);
    expect(isSegmentPlaybackSession(global)).toBe(false);
    expect(isSegmentPlaybackSession(null)).toBe(false);
    expect(isGlobalPlaybackSession(global)).toBe(true);
    expect(isGlobalPlaybackSession(segment)).toBe(false);
  });
});
