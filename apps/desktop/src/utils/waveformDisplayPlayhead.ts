/** Display playhead: visual clock when ready; raw media only before ready. */
export function resolveDisplayPlayheadTimeSec(input: {
  isPlaying: boolean;
  isReady: boolean;
  getVisualPlayheadTimeSec: () => number;
  getRawMediaPlayheadTimeSec: () => number;
}): number {
  if (!input.isReady) return input.getRawMediaPlayheadTimeSec();
  const visual = input.getVisualPlayheadTimeSec();
  if (!input.isPlaying) return visual;
  const media = input.getRawMediaPlayheadTimeSec();
  if (Number.isFinite(media) && media > visual) return media;
  return visual;
}

/** Playback / seek decisions — same contract as display playhead (single authority when ready). */
export const resolveAuthoritativePlayheadTimeSec = resolveDisplayPlayheadTimeSec;
