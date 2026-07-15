import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../../tauri/projectApi";
import type { ActiveSegmentPlaybackBound } from "../../utils/segmentPlaybackBound";
import {
  resolveMediaPlaybackHost,
  type PlaybackTransport,
  type SegmentPlayFromResolution,
} from "./transport";
import { endMediaPlay, enqueueMediaOp, tryBeginMediaPlay } from "../../utils/mediaPlayGate";
import { resolveSegmentBoundArmAfterPlayStart } from "./segmentPlayBoundArm";

export type RunPlaySegmentResolvedInput = {
  ws: WaveSurfer | null;
  transport: PlaybackTransport | null | undefined;
  requireTransport?: boolean;
  isReady: boolean;
  segment: SegmentDto | undefined;
  playFrom: SegmentPlayFromResolution;
  loop?: boolean;
  playGenerationRef: React.MutableRefObject<number>;
  playStartInFlightGenerationRef: React.MutableRefObject<number | null>;
  /** Manual pause in flight — cleared here so a new play isn't held Stop-off. */
  segmentPauseInFlightRef: React.MutableRefObject<boolean>;
  segmentPlaybackBoundRef: React.MutableRefObject<ActiveSegmentPlaybackBound | null>;
  unboundedSelectedPlayGenRef: React.MutableRefObject<number | null>;
  segmentLoopPlaybackRef: React.MutableRefObject<boolean>;
  clearSegmentPlaybackBound: (opts?: { preservePlayingChrome?: boolean }) => void;
  setSegmentLoopPlayback: (loop: boolean) => void;
  setIsSelectedSegmentPlaying: (playing: boolean) => void;
  armSegmentPlaybackSession: (idx: number) => void;
  applyGlobalPlaybackRate: () => void;
  atomicMediaSeek: (timeSec: number) => Promise<void>;
  resolvePlayheadSec: () => number;
  idx: number;
};

/** Transport Authority: play with play-from already resolved by dispatcher. */
export async function runPlaySegmentResolved(
  input: RunPlaySegmentResolvedInput,
): Promise<void> {
  const host = resolveMediaPlaybackHost(input.ws, input.transport, {
    requireTransport: input.requireTransport,
  });
  if (!host || !input.isReady) return;
  const gateOpts = host.isNative ? { pauseToPlayGapMs: 0 } : undefined;
  const seg = input.segment;
  if (!seg) return;
  // Hold the play gate across seek+play so Space/toggle cannot nest play().
  if (!tryBeginMediaPlay(host.gateHost)) return;
  try {
    const gen = ++input.playGenerationRef.current;
    input.playStartInFlightGenerationRef.current = gen;
    // A fresh play supersedes any pending pause chrome hold.
    input.segmentPauseInFlightRef.current = false;
    // Preserve widget Stop chrome across async seek/play — clearing it here caused
    // Play↔Stop flicker on every segment play / restart.
    input.clearSegmentPlaybackBound({ preservePlayingChrome: true });
    input.setIsSelectedSegmentPlaying(true);
    const range = {
      start: Math.min(seg.start_sec, seg.end_sec),
      end: Math.max(seg.start_sec, seg.end_sec),
    };
    input.applyGlobalPlaybackRate();
    if (input.loop) {
      input.segmentLoopPlaybackRef.current = true;
      input.setSegmentLoopPlayback(true);
    }

    const wasPlaying = host.isPlaying();
    const seekToSec = input.playFrom.kind === "seek" ? input.playFrom.timeSec : null;
    let startAtSec = input.resolvePlayheadSec();
    if (seekToSec != null) {
      startAtSec = seekToSec;
    }

    // Already playing: seek only — never pause+play (nests RemoteAudioSession sync IPC).
    if (wasPlaying) {
      if (seekToSec != null) {
        await enqueueMediaOp(host.gateHost, "seek", async () => {
          await input.atomicMediaSeek(seekToSec);
        }, gateOpts);
      }
    } else {
      if (seekToSec != null) {
        await enqueueMediaOp(host.gateHost, "seek", async () => {
          await input.atomicMediaSeek(seekToSec);
        }, gateOpts);
      }
      try {
        await enqueueMediaOp(host.gateHost, "play", async () => {
          await host.play();
        }, gateOpts);
      } catch {
        if (input.playStartInFlightGenerationRef.current === gen) {
          input.playStartInFlightGenerationRef.current = null;
        }
        if (gen !== input.playGenerationRef.current) return;
        input.clearSegmentPlaybackBound();
        return;
      }
    }

    if (gen !== input.playGenerationRef.current) {
      if (input.playStartInFlightGenerationRef.current === gen) {
        input.playStartInFlightGenerationRef.current = null;
      }
      if (host.isPlaying()) {
        await enqueueMediaOp(host.gateHost, "pause", () => {
          void Promise.resolve(host.pause());
        }, gateOpts);
      }
      return;
    }
    if (!host.isPlaying()) {
      if (input.playStartInFlightGenerationRef.current === gen) {
        input.playStartInFlightGenerationRef.current = null;
      }
      input.clearSegmentPlaybackBound();
      return;
    }

    // Only scope-stop at segment end when starting inside the selected segment.
    // Past end (gap after): free play from playhead — keep Stop chrome via unbounded gen.
    const arm = resolveSegmentBoundArmAfterPlayStart({
      startAtSec,
      rangeStart: range.start,
      rangeEnd: range.end,
      generation: gen,
    });
    input.segmentPlaybackBoundRef.current = arm.bound;
    input.unboundedSelectedPlayGenRef.current = arm.unboundedSelectedPlayGen;
    input.setIsSelectedSegmentPlaying(true);
    input.armSegmentPlaybackSession(input.idx);
    // Clear in-flight only after bound+chrome are armed so mid-seek sync cannot flash Play.
    if (input.playStartInFlightGenerationRef.current === gen) {
      input.playStartInFlightGenerationRef.current = null;
    }
  } finally {
    endMediaPlay(host.gateHost);
  }
}
