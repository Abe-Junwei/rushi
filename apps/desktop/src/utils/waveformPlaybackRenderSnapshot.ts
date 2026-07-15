import { playheadViewportLeftPx } from "./waveformProjection";
import {
  resolvePlaybackScrollFollowTargetPx,
  WAVEFORM_EDGE_FOLLOW,
  type WaveformPlaybackScrollFollowMode,
} from "./waveformPlaybackScrollFollow";
import { WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "./waveformScrollSync";
import {
  CENTER_FOLLOW_RECONCILE_PX,
  PLAYBACK_SUBPIXEL_ENABLED,
  SUBPIXEL_DEBUG_AMPLIFY,
  setCenterFollowDriving,
  setEdgeFollowDriving,
  clearPlaybackFollowDriving,
} from "./waveformPlaybackSubpixel";
import {
  setPlaybackFractionalPx,
  writePlaybackRenderSnapshot,
  type PlaybackRenderSnapshot,
} from "./tierScrollFrameCoordinator";

export type CalculatePlaybackFollowInput = {
  followMode: WaveformPlaybackScrollFollowMode;
  timeSec: number;
  timelineWidthPx: number;
  durationSec: number;
  viewportWidthPx: number;
  currentScrollLeftPx: number;
  currentFractionalPx: number;
  subpixelFollow: boolean;
};

export type PlaybackFollowGeometry = {
  scrollWritePx: number | null;
  fractionalPx: number;
  centerFollowDriving: boolean;
  edgeFollowDriving: boolean;
  snapshot: PlaybackRenderSnapshot;
};

/** Pure geometry — no DOM / coordinator writes. */
export function calculatePlaybackFollowGeometry(
  input: CalculatePlaybackFollowInput,
): PlaybackFollowGeometry {
  const t = Math.max(0, Math.min(input.durationSec, input.timeSec));
  const vw = Math.max(1, input.viewportWidthPx);
  const currentScrollLeftPx = input.currentScrollLeftPx;

  const target = resolvePlaybackScrollFollowTargetPx({
    mode: input.followMode,
    timeSec: t,
    timelineWidthPx: input.timelineWidthPx,
    durationSec: input.durationSec,
    viewportWidthPx: vw,
    currentScrollLeftPx,
  });

  const edgePageDriving =
    input.followMode === "edge" &&
    Math.abs(target - currentScrollLeftPx) > WAVEFORM_SCROLL_SYNC_EPSILON_PX;

  const subpixel =
    PLAYBACK_SUBPIXEL_ENABLED &&
    input.subpixelFollow &&
    (input.followMode === "center" || edgePageDriving);

  let scrollWritePx: number | null = null;
  let fractionalPx = 0;
  let centerDriving = false;
  let edgeDriving = false;
  let committedScrollLeftPx = currentScrollLeftPx;

  if (subpixel) {
    centerDriving = input.followMode === "center";
    edgeDriving = input.followMode === "edge";
    const offset = target - currentScrollLeftPx;
    const reconcilePx =
      input.followMode === "edge"
        ? Math.max(CENTER_FOLLOW_RECONCILE_PX, vw * 0.85)
        : CENTER_FOLLOW_RECONCILE_PX;
    if (Math.abs(offset) >= reconcilePx) {
      const rounded = Math.round(target);
      scrollWritePx = rounded;
      committedScrollLeftPx = rounded;
      // Residual is sub-pixel by construction (target - round(target) ∈ [-0.5, 0.5]);
      // keep it for both modes so the needle/tint stay aligned across page turns.
      // Seek/large-jump float destruction is owned by snapPlaybackViewportAfterSeek.
      fractionalPx = (target - rounded) * SUBPIXEL_DEBUG_AMPLIFY;
    } else {
      fractionalPx = offset * SUBPIXEL_DEBUG_AMPLIFY;
    }
  } else if (PLAYBACK_SUBPIXEL_ENABLED && input.subpixelFollow && input.followMode === "edge") {
    if (input.currentFractionalPx !== 0) {
      const sunk = Math.round(currentScrollLeftPx + input.currentFractionalPx);
      scrollWritePx = sunk;
      committedScrollLeftPx = sunk;
      fractionalPx = 0;
    }
  } else {
    fractionalPx = 0;
    const scrollTarget =
      PLAYBACK_SUBPIXEL_ENABLED && input.followMode === "center" ? Math.round(target) : target;
    const minDeltaPx =
      input.followMode === "center" ? 0 : WAVEFORM_SCROLL_SYNC_EPSILON_PX;
    if (Math.abs(scrollTarget - currentScrollLeftPx) > minDeltaPx) {
      scrollWritePx = scrollTarget;
      committedScrollLeftPx = scrollTarget;
    }
  }

  const effectiveScrollLeftPx = committedScrollLeftPx + fractionalPx;
  const pinCenter =
    PLAYBACK_SUBPIXEL_ENABLED && input.subpixelFollow && centerDriving && vw > 0;
  const pinEdge =
    PLAYBACK_SUBPIXEL_ENABLED && input.subpixelFollow && edgeDriving && vw > 0;
  const playheadLeft = pinCenter
    ? vw / 2
    : pinEdge
      ? vw * WAVEFORM_EDGE_FOLLOW.anchorFrac
      : playheadViewportLeftPx(
          t,
          effectiveScrollLeftPx,
          input.timelineWidthPx,
          input.durationSec,
        );

  return {
    scrollWritePx,
    fractionalPx,
    centerFollowDriving: centerDriving,
    edgeFollowDriving: edgeDriving,
    snapshot: {
      timeSec: t,
      scrollLeftPx: committedScrollLeftPx,
      fractionalPx,
      centerFollowDriving: centerDriving,
      edgeFollowDriving: edgeDriving,
      playheadViewportLeftPx: playheadLeft,
    },
  };
}

export function commitPlaybackFollowGeometry(args: {
  geometry: PlaybackFollowGeometry;
  playbackFollowScroll: (
    scrollLeftPx: number,
    options?: { deferLayoutCommit?: boolean },
  ) => void;
  deferLayoutCommit?: boolean;
  /**
   * Snapshot is a per-frame contract (written by follow @Pri0, read by playhead
   * @Pri1, cleared at frame end). Only the playing/subpixel commit runs inside a
   * frame — the paused path runs outside one, so it must clear (never leak) the
   * snapshot to avoid a stale read on the next tier-only frame.
   */
  writeSnapshot?: boolean;
}): void {
  const { geometry } = args;
  writePlaybackRenderSnapshot(args.writeSnapshot === false ? null : geometry.snapshot);

  if (geometry.centerFollowDriving) {
    setCenterFollowDriving(true);
    setEdgeFollowDriving(false);
  } else if (geometry.edgeFollowDriving) {
    setCenterFollowDriving(false);
    setEdgeFollowDriving(true);
  } else {
    clearPlaybackFollowDriving();
  }

  if (geometry.scrollWritePx != null) {
    if (args.deferLayoutCommit !== undefined) {
      args.playbackFollowScroll(geometry.scrollWritePx, {
        deferLayoutCommit: args.deferLayoutCommit,
      });
    } else {
      args.playbackFollowScroll(geometry.scrollWritePx);
    }
  }

  setPlaybackFractionalPx(geometry.fractionalPx);
}

export type { PlaybackRenderSnapshot } from "./tierScrollFrameCoordinator";
