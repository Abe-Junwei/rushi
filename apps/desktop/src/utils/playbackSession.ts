/** Sticky Space / toolbar transport session (global vs scoped segment). */
export type PlaybackSession =
  | { kind: "global" }
  | { kind: "segment"; idx: number };

export function isSegmentPlaybackSession(
  session: PlaybackSession | null | undefined,
): session is { kind: "segment"; idx: number } {
  return session?.kind === "segment";
}

export function isGlobalPlaybackSession(
  session: PlaybackSession | null | undefined,
): session is { kind: "global" } {
  return session?.kind === "global";
}
