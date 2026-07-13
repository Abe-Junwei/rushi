import { useCallback, useRef } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import {
  resolveGlobalTogglePlay,
  resolveSessionTogglePlay,
} from "../utils/playbackSessionToggle";
import { resolveStickySegmentSpaceFromSec } from "../utils/segmentResumeFromSec";
import { resolveSegmentIdxContainingPlayhead } from "../utils/segmentPlaybackStructureRemap";
import type { useWaveformPlayback } from "./useWaveformPlayback";
import type { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";

type PlaybackApi = ReturnType<typeof useWaveformPlayback>;
type SegmentPlaybackApi = ReturnType<typeof useWaveformSegmentPlaybackControls>;

/** Space / toolbar global toggle decisions (sticky session). */
export function useProjectWaveformSessionToggle(args: {
  resolveHost: () => ReturnType<
    typeof import("../services/waveform/transport").resolveMediaPlaybackHost
  >;
  playback: PlaybackApi;
  segmentPlayback: SegmentPlaybackApi;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  selectedIdxForTransportRef: React.MutableRefObject<number>;
  playSegmentAtIndex: (
    idx: number,
    playOpts?: { loop?: boolean; fromSec?: number },
  ) => Promise<void>;
  dispatchTransport: (
    intent: import("../services/waveform/transport").TransportIntent,
  ) => Promise<void>;
}) {
  const {
    resolveHost,
    playback,
    segmentPlayback,
    segmentsRef,
    selectedIdxForTransportRef,
    playSegmentAtIndex,
    dispatchTransport,
  } = args;

  const sessionToggleInFlightRef = useRef(false);

  const togglePlay = useCallback(async () => {
    if (sessionToggleInFlightRef.current) return;
    sessionToggleInFlightRef.current = true;
    try {
      const host = resolveHost();
      const selectedSegmentIdx = effectiveTranscriptPrimaryIdx(
        selectedIdxForTransportRef.current,
      );
      const playheadSec = playback.getPlayheadTime();
      const playheadContainingIdx = resolveSegmentIdxContainingPlayhead(
        segmentsRef.current,
        playheadSec,
      );
      const decision = resolveSessionTogglePlay({
        isPlaying: Boolean(host?.isPlaying()),
        session: segmentPlayback.getPlaybackSession(),
        segmentStillExists: (() => {
          const session = segmentPlayback.getPlaybackSession();
          return session?.kind === "segment"
            ? Boolean(segmentsRef.current[session.idx])
            : undefined;
        })(),
        playheadContainingIdx:
          playheadContainingIdx >= 0 ? playheadContainingIdx : undefined,
        selectedSegmentIdx:
          selectedSegmentIdx >= 0 && segmentsRef.current[selectedSegmentIdx]
            ? selectedSegmentIdx
            : undefined,
        preferGlobalSpace: segmentPlayback.isBlankGlobalSpaceArmed(),
      });
      if (decision.action === "pauseKeepingSession") {
        segmentPlayback.pauseMediaKeepingSession();
        return;
      }
      if (decision.action === "resumeSegment") {
        const seg = segmentsRef.current[decision.idx];
        if (!seg) {
          segmentPlayback.beginGlobalPlayback();
          await playback.togglePlay();
          return;
        }
        const stickyFromSec = resolveStickySegmentSpaceFromSec({
          segment: seg,
          displaySec: playback.getPlayheadTime(),
          authoritySec: playback.getAuthorityPlayheadTimeSec(),
        });
        await playSegmentAtIndex(
          decision.idx,
          stickyFromSec != null ? { fromSec: stickyFromSec } : undefined,
        );
        return;
      }
      segmentPlayback.beginGlobalPlayback();
      await playback.togglePlay();
    } finally {
      sessionToggleInFlightRef.current = false;
    }
  }, [
    playSegmentAtIndex,
    playback,
    resolveHost,
    segmentPlayback,
    segmentsRef,
    selectedIdxForTransportRef,
  ]);

  const toggleGlobalPlay = useCallback(async () => {
    if (sessionToggleInFlightRef.current) return;
    sessionToggleInFlightRef.current = true;
    try {
      const host = resolveHost();
      const decision = resolveGlobalTogglePlay({
        isPlaying: Boolean(host?.isPlaying()),
        session: segmentPlayback.getPlaybackSession(),
      });
      if (decision.action === "exitSegmentToGlobal") {
        segmentPlayback.beginGlobalPlayback();
        return;
      }
      if (decision.action === "pauseKeepingSession") {
        segmentPlayback.pauseMediaKeepingSession();
        return;
      }
      segmentPlayback.beginGlobalPlayback();
      await playback.togglePlay();
    } finally {
      sessionToggleInFlightRef.current = false;
    }
  }, [playback, resolveHost, segmentPlayback]);

  const handleToggleSelectedWaveformPlay = useCallback(async () => {
    const idx = effectiveTranscriptPrimaryIdx(selectedIdxForTransportRef.current);
    if (idx < 0 || !segmentsRef.current[idx]) return;
    await dispatchTransport({ kind: "toggleSegmentPlay" });
  }, [dispatchTransport, segmentsRef, selectedIdxForTransportRef]);

  return {
    togglePlay,
    toggleGlobalPlay,
    handleToggleSelectedWaveformPlay,
  };
}
