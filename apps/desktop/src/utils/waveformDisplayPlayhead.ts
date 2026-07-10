/** Display playhead: single time source via visualTimeSecRef; raw media only before ready. */
export function resolveDisplayPlayheadTimeSec(input: {
  isReady: boolean;
  getVisualPlayheadTimeSec: () => number;
  getRawMediaPlayheadTimeSec: () => number;
}): number {
  if (!input.isReady) return input.getRawMediaPlayheadTimeSec();
  return input.getVisualPlayheadTimeSec();
}
