import { useCallback, useMemo } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import {
  applyPeaksOrderedSeek,
  dispatchTransportIntent,
  resolveMediaPlaybackHost,
  type PlaybackTransport,
  type TransportIntent,
} from "../services/waveform/transport";
import { resolveWaveformPlayheadChromeMode } from "../utils/waveformPlayheadChrome";
import { noteMediaPaused, runGatedMediaPlay } from "../utils/mediaPlayGate";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";
import type { useWaveformPlayback } from "./useWaveformPlayback";
import type { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import { useProjectWaveformSessionToggle } from "./useProjectWaveformSessionToggle";

type PlaybackApi = ReturnType<typeof useWaveformPlayback>;
type SegmentPlaybackApi = ReturnType<typeof useWaveformSegmentPlaybackControls>;

/** Transport seek / Space / session toggle façade for project waveform. */
export function useProjectWaveformTransport(args: {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  transportRef: React.MutableRefObject<PlaybackTransport | null>;
  useNativeTransport: boolean;
  isReady: boolean;
  isPlaying: boolean;
  layoutDurationSecRef: React.MutableRefObject<number>;
  optsRef: React.MutableRefObject<UseProjectWaveformOptions>;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  selectedIdxForTransportRef: React.MutableRefObject<number>;
  commitSeekUi: (timeSec: number) => void;
  playback: PlaybackApi;
  segmentPlayback: SegmentPlaybackApi;
}) {
  const {
    wsRef,
    transportRef,
    useNativeTransport,
    isReady,
    isPlaying,
    layoutDurationSecRef,
    optsRef,
    segmentsRef,
    selectedIdxForTransportRef,
    commitSeekUi,
    playback,
    segmentPlayback,
  } = args;

  const resolveHost = useCallback(
    () =>
      resolveMediaPlaybackHost(wsRef.current, transportRef.current, {
        requireTransport: useNativeTransport,
      }),
    [transportRef, useNativeTransport, wsRef],
  );

  const suppressPlaybackFollow = useCallback(() => {
    const untilRef = optsRef.current.playbackFollowSuppressUntilRef;
    if (untilRef) untilRef.current = performance.now() + 1200;
  }, [optsRef]);

  const dispatchTransport = useCallback(
    async (intent: TransportIntent) => {
      const host = resolveHost();
      const media = host
        ? {
            setTime: (t: number) => {
              void Promise.resolve(host.setTime(t));
            },
            play: () => {
              const gateOpts = host.isNative ? { pauseToPlayGapMs: 0 } : undefined;
              return runGatedMediaPlay(host.gateHost, () => host.play(), gateOpts).then(
                () => undefined,
              );
            },
            pause: () => {
              void Promise.resolve(host.pause()).finally(() => {
                noteMediaPaused(host.gateHost);
              });
            },
            isPlaying: () => host.isPlaying(),
          }
        : {
            setTime: () => undefined,
            play: () => Promise.resolve(),
            pause: () => undefined,
            isPlaying: () => false,
          };
      await dispatchTransportIntent(intent, {
        isReady,
        getDurationSec: () =>
          resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current }),
        syncDisplayPlayheadAfterSeek: (t) =>
          optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t),
        commitSeekUi,
        suppressPlaybackFollow,
        media,
        applySeek: async (timeSec, seekOpts) => {
          segmentPlayback.clearPausedResumeAnchor();
          if (seekOpts?.suppressFollow) suppressPlaybackFollow();
          if (segmentPlayback.isSelectedSegmentPlaying) {
            segmentPlayback.clearSegmentPlaybackBound();
          }
          const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
          await applyPeaksOrderedSeek({
            timeSec,
            durationSec: d,
            syncDisplayPlayheadAfterSeek: (t) =>
              optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t),
            setTime: (t) => {
              const live = resolveHost();
              return live?.setTime(t);
            },
            commitSeekUi,
          });
        },
        runPlaySegment: (playArgs) => segmentPlayback.runPlaySegmentResolved(playArgs),
        runToggleSegmentPlay: () => segmentPlayback.toggleSelectedWaveformPlayImpl(),
        resolvePlayFromInput: (idx, fromSec) => {
          const seg = segmentsRef.current[idx];
          if (!seg) return null;
          return {
            segment: seg,
            fromSec,
            displaySec: playback.getPlayheadTime(),
            authoritySec: playback.getAuthorityPlayheadTimeSec(),
          };
        },
        resolveSegmentResumeFromSec: (idx, fromSec) =>
          segmentPlayback.consumeSegmentResumeFromSec(idx, fromSec),
      });
    },
    [
      commitSeekUi,
      isReady,
      layoutDurationSecRef,
      optsRef,
      playback,
      resolveHost,
      segmentPlayback,
      segmentsRef,
      suppressPlaybackFollow,
    ],
  );

  const seek = useCallback(
    (timeSec: number) => {
      void dispatchTransport({ kind: "seek", timeSec, source: "segmentSelect" });
    },
    [dispatchTransport],
  );

  const seekBlankToTime = useCallback(
    (timeSec: number) => {
      segmentPlayback.beginGlobalPlayback();
      segmentPlayback.armBlankGlobalSpace();
      void dispatchTransport({
        kind: "seek",
        timeSec,
        source: "blankTap",
        suppressFollow: true,
      });
    },
    [dispatchTransport, segmentPlayback],
  );

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const base = playback.getPlayheadTime();
      void dispatchTransport({
        kind: "seek",
        timeSec: base + deltaSec,
        source: "keyboardFrame",
      });
    },
    [dispatchTransport, playback],
  );

  const playSegmentAtIndex = useCallback(
    async (idx: number, playOpts?: { loop?: boolean; fromSec?: number }) => {
      await dispatchTransport({
        kind: "playSegment",
        idx,
        fromSec: playOpts?.fromSec,
        loop: playOpts?.loop,
      });
    },
    [dispatchTransport],
  );

  const { togglePlay, toggleGlobalPlay, handleToggleSelectedWaveformPlay } =
    useProjectWaveformSessionToggle({
      resolveHost,
      playback,
      segmentPlayback,
      segmentsRef,
      selectedIdxForTransportRef,
      playSegmentAtIndex,
      dispatchTransport,
    });

  const playheadChromeMode = useMemo(
    () =>
      resolveWaveformPlayheadChromeMode({
        session: segmentPlayback.getPlaybackSession(),
        isPlaying,
        isSelectedSegmentPlaying: segmentPlayback.isSelectedSegmentPlaying,
        preferGlobalSpace: segmentPlayback.isBlankGlobalSpaceArmed(),
      }),
    [
      isPlaying,
      segmentPlayback.getPlaybackSession,
      segmentPlayback.isBlankGlobalSpaceArmed,
      segmentPlayback.isSelectedSegmentPlaying,
      segmentPlayback.playbackChromeEpoch,
    ],
  );

  return {
    resolveHost,
    dispatchTransport,
    seek,
    seekBlankToTime,
    seekByDelta,
    playSegmentAtIndex,
    togglePlay,
    toggleGlobalPlay,
    handleToggleSelectedWaveformPlay,
    playheadChromeMode,
  };
}
