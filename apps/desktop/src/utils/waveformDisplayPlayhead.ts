/**
 * Display playhead: single UI time source via visualTimeSecRef.
 * Before ready, fall back to the engine display poll (ADR-0008 interpolator).
 */
export function resolveDisplayPlayheadTimeSec(input: {
  isReady: boolean;
  getVisualPlayheadTimeSec: () => number;
  getEngineDisplayTimeSec: () => number;
}): number {
  if (!input.isReady) return input.getEngineDisplayTimeSec();
  return input.getVisualPlayheadTimeSec();
}
