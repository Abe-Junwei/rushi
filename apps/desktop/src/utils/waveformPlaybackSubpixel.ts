import { useEffect, type RefObject } from "react";
import { setDirectLayoutStyle } from "./cspElementLayout";
import {
  readPlaybackFractionalPx,
  subscribeTierScrollFrame,
} from "./tierScrollFrameCoordinator";

/**
 * Playback-follow subpixel (A2 → P1): freeze integer `scrollLeft` while follow
 * is driving continuous motion; put all motion in a shared float offset so GPU
 * transform carries continuous motion without per-frame native scroll tear.
 *
 * Applies to:
 *   - center: always while playing
 *   - edge: only while past the edge trigger (page-drive); mid-band stays frozen
 *     with offset=0 so the needle sweeps freely over stationary content
 *
 * Sign contract:
 *   - content layer: translate3d(-offset) on top of native -S → visual -T
 *   - playhead (P0): hard-pin while driving (center → vw/2; edge → anchorFrac×vw);
 *     never add offset to the pin layer
 *   - effectiveScrollLeftPx = S + offset = T for any non-pinned reader
 *
 * Reconcile: when |T - S| ≥ CENTER_FOLLOW_RECONCILE_PX, sink round(T) into
 * scrollLeft and keep only the sub-pixel residual — keeps window-canvas buffers
 * (≈1.5 viewport) fresh without writing scroll every frame.
 *
 * See docs/execution/specs/waveform-center-follow-subpixel-plan.md.
 */

export const PLAYBACK_SUBPIXEL_ENABLED = true;

/**
 * Must stay 1 in any real playback path. amp≠1 breaks continuity at reconcile
 * boundaries. Dye verification: temporarily set to 10 ONLY at very low zoom;
 * never leave elevated for normal / high-zoom play.
 */
export const SUBPIXEL_DEBUG_AMPLIFY = 1;

/**
 * Max |T − scrollLeft| before sinking the integer part back into native scroll.
 * Peaks/band windows buffer ≈1.5 viewports — keep well inside that margin.
 * Larger = fewer reconciles = fewer chances for late scroll-event suppress races.
 */
export const CENTER_FOLLOW_RECONCILE_PX = 200;

/**
 * True while center P1 follow is actively driving the float offset this session.
 * Playhead hard-pin (P0) only applies while driving — if user-scroll suppress
 * freezes follow, fall back to effectiveScroll mapping so needle and wash stay synced.
 */
let centerFollowDriving = false;

/** True while edge page-drive P1 is active (past trigger); mid-band is false. */
let edgeFollowDriving = false;

export function setCenterFollowDriving(active: boolean): void {
  centerFollowDriving = active;
}

export function isCenterFollowDriving(): boolean {
  return centerFollowDriving;
}

export function setEdgeFollowDriving(active: boolean): void {
  edgeFollowDriving = active;
}

export function isEdgeFollowDriving(): boolean {
  return edgeFollowDriving;
}

/** Clear both driving flags (suppress / stop / mid-band exit). */
export function clearPlaybackFollowDriving(): void {
  centerFollowDriving = false;
  edgeFollowDriving = false;
}

/**
 * Pin the content layer's float offset to the shared residual.
 * `translate3d(-offset)` on top of native scroll (-S) produces -T.
 */
export function useWaveformSubpixelContentShift(
  ref: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    let lastTransform = "";
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const offset = PLAYBACK_SUBPIXEL_ENABLED ? readPlaybackFractionalPx() : 0;
      const transform = `translate3d(${(-offset).toFixed(3)}px, 0, 0)`;
      if (transform === lastTransform) return;
      lastTransform = transform;
      setDirectLayoutStyle(el, { transform });
    };
    apply();
    return subscribeTierScrollFrame(apply);
  }, [ref]);
}
