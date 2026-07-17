/**
 * Single seek-settle window shared by every post-seek grounding/guard so they
 * release **together** (one clean handoff) instead of at staggered wall-clock
 * times.
 *
 * Before unification these lived as separate constants anchored at two different
 * reference points (seek dispatch vs seeked ACK) with three different durations
 * (400 / 500 / 600ms):
 *   - frontend visual-clock display grounding
 *   - frontend playback-follow suppression
 *   - native stale-TimeUpdate guard
 *   - native settle "no maxDrift jump" window
 * On Windows the seeked-ACK Channel lag staggered their expiry, so the playhead
 * took several corrective steps as each window released one after another — the
 * "left-right flicker on seek during playback", amplified by zoom because the
 * needle x = time·pxPerSec (a small time wobble becomes a large pixel jump).
 *
 * Invariant: every post-seek settle window MUST use this value, anchored at the
 * seeked ACK (native re-arms in its `seeked` handler; the UI arms in
 * `endVisualSeek`). Keeping one anchor + one duration collapses the staggered
 * releases into a single handoff.
 */
export const SEEK_SETTLE_WINDOW_MS = 500;
