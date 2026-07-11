import type { MutableRefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import { applyPeaksOrderedSeek } from "./transport";
import { resolveLayoutDurationSec } from "../../utils/waveformTimelineMetrics";

/** Apply the global transport playback rate onto the live WaveSurfer instance. */
export function applyWaveformGlobalPlaybackRate(args: {
  ws: WaveSurfer | null;
  getGlobalPlaybackRate: () => number;
}): void {
  const { ws, getGlobalPlaybackRate } = args;
  if (!ws) return;
  ws.setPlaybackRate(getGlobalPlaybackRate());
}

/** Peaks-ordered seek used by segment-scoped play / end-stop. */
export function atomicWaveformSegmentSeek(args: {
  ws: WaveSurfer;
  timeSec: number;
  layoutDurationSecRef?: MutableRefObject<number>;
  syncDisplayPlayheadAfterSeekRef?: MutableRefObject<((timeSec: number) => void) | null>;
  commitSeekUi?: (timeSec: number) => void;
}): void {
  const {
    ws,
    timeSec,
    layoutDurationSecRef,
    syncDisplayPlayheadAfterSeekRef,
    commitSeekUi,
  } = args;
  const d = layoutDurationSecRef
    ? resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current })
    : ws.getDuration() || 0;
  applyPeaksOrderedSeek({
    timeSec,
    durationSec: d,
    syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
    setTime: (t) => ws.setTime(t),
    commitSeekUi,
  });
}
