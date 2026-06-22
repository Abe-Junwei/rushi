/** Display playhead: visual clock while playing, WaveSurfer media time when paused. */
export function resolveDisplayPlayheadTimeSec(input: {
  isPlaying: boolean;
  isReady: boolean;
  getVisualPlayheadTimeSec: () => number;
  getMediaPlayheadTimeSec: () => number;
}): number {
  if (input.isReady && input.isPlaying) return input.getVisualPlayheadTimeSec();
  return input.getMediaPlayheadTimeSec();
}
