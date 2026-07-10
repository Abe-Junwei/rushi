/**
 * Peaks `ws.load` intent debounce while continuous slider / step zoom is in flight.
 * Layout (`ws.zoom` stretch) stays immediate; draw track trails so N steps → 1 load.
 * WR-2: 120–160ms window (was 500ms unused).
 */
export const DRAW_PX_PER_SEC_DEBOUNCE_MS = 140;

export const PREF_WRITE_DEBOUNCE_MS = 180;
