import type { MutableRefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import { applyPeaksOrderedSeek, resolveMediaPlaybackHost } from "./transport";
import type { PlaybackTransport } from "./transport/playbackTransport";
import { resolveLayoutDurationSec } from "../../utils/waveformTimelineMetrics";

/** Apply the global transport playback rate onto the live media host. */
export function applyWaveformGlobalPlaybackRate(args: {
  ws: WaveSurfer | null;
  transport?: PlaybackTransport | null;
  requireTransport?: boolean;
  getGlobalPlaybackRate: () => number;
}): void {
  const { ws, transport, requireTransport, getGlobalPlaybackRate } = args;
  const host = resolveMediaPlaybackHost(ws, transport, { requireTransport });
  if (!host) return;
  void Promise.resolve(host.setPlaybackRate(getGlobalPlaybackRate()));
}

/** Peaks-ordered seek used by segment-scoped play / end-stop. */
export async function atomicWaveformSegmentSeek(args: {
  ws: WaveSurfer;
  transport?: PlaybackTransport | null;
  requireTransport?: boolean;
  timeSec: number;
  layoutDurationSecRef?: MutableRefObject<number>;
  syncDisplayPlayheadAfterSeekRef?: MutableRefObject<((timeSec: number) => void) | null>;
  beginVisualSeekRef?: MutableRefObject<((timeSec: number) => void) | null>;
  endVisualSeekRef?: MutableRefObject<((timeSec: number) => void) | null>;
  snapPlaybackViewportAfterSeekRef?: MutableRefObject<((timeSec: number) => void) | null>;
  commitSeekUi?: (timeSec: number) => void;
}): Promise<void> {
  const {
    ws,
    transport,
    requireTransport,
    timeSec,
    layoutDurationSecRef,
    syncDisplayPlayheadAfterSeekRef,
    beginVisualSeekRef,
    endVisualSeekRef,
    snapPlaybackViewportAfterSeekRef,
    commitSeekUi,
  } = args;
  const host = resolveMediaPlaybackHost(ws, transport, { requireTransport });
  if (!host) return;
  const d = layoutDurationSecRef
    ? resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current })
    : transport?.getDuration() || ws.getDuration() || 0;
  await applyPeaksOrderedSeek({
    timeSec,
    durationSec: d,
    beginVisualSeek: (t) => beginVisualSeekRef?.current?.(t) ?? syncDisplayPlayheadAfterSeekRef?.current?.(t),
    endVisualSeek: (t) => endVisualSeekRef?.current?.(t),
    snapPlaybackViewportAfterSeek: (t) => snapPlaybackViewportAfterSeekRef?.current?.(t),
    setTime: (t) => host.setTime(t),
    commitSeekUi,
  });
}
