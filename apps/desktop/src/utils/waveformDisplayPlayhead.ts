/** Display playhead: visual clock when ready; raw media only before ready. */
export function resolveDisplayPlayheadTimeSec(input: {
  isPlaying: boolean;
  isReady: boolean;
  getVisualPlayheadTimeSec: () => number;
  getMediaPlayheadTimeSec: () => number;
}): number {
  if (input.isReady) return input.getVisualPlayheadTimeSec();
  return input.getMediaPlayheadTimeSec();
}

/** Playback / seek decisions — same contract as display playhead (single authority when ready). */
export const resolveAuthoritativePlayheadTimeSec = resolveDisplayPlayheadTimeSec;
