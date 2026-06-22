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
