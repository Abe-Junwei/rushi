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
import { logDesktopUi } from "../services/desktopUiLog";
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
    // Viewport snap owns scroll/pin. Do not arm a suppress window here — the
    // beginVisualSeek call immediately below (same sync stack, no await between)
    // already re-arms POSITIVE_INFINITY; arming here too is redundant and, if that
    // invariant ever changes, would reintroduce zoom-amplified catch-up thrash
    // (see d8b181cc).
    if (untilRef) untilRef.current = 0;
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
            // Seek during playback (select / scrub to another segment) drops the old
            // scoped bound, but media keeps playing — do NOT flip chrome to Play here.
            // The per-frame sync re-arms against the new selection/playhead, so keeping
            // Stop chrome avoids the Stop→Play→Stop flash. Only release chrome when the
            // media is actually stopped.
            const live = resolveHost();
            segmentPlayback.clearSegmentPlaybackBound({
              preservePlayingChrome: Boolean(live?.isPlaying()),
            });
          }
          const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
          const followMode = optsRef.current.playbackScrollFollowModeRef?.current ?? "edge";
          // Live media flag — React `isPlaying` in this closure can be stale (deps omit
          // it), which wrongly enabled edge seek-land snap while audio was playing.
          const livePlaying = Boolean(resolveHost()?.isPlaying());
          const skipViewportSnap = Boolean(
            seekOpts?.suppressFollow && livePlaying && followMode === "edge",
          );
          await applyPeaksOrderedSeek({
            timeSec,
            durationSec: d,
            beginVisualSeek: (t, opts) => optsRef.current.beginVisualSeekRef?.current?.(t, opts),
            endVisualSeek: (t) => optsRef.current.endVisualSeekRef?.current?.(t),
            snapPlaybackViewportAfterSeek: (t) =>
              optsRef.current.snapPlaybackViewportAfterSeekRef?.current?.(t),
            setTime: (t) => {
              const live = resolveHost();
              return live?.setTime(t);
            },
            commitSeekUi,
            skipViewportSnap,
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

  const runSeekTransport = useCallback(
    (intent: Extract<TransportIntent, { kind: "seek" }>) => {
      void dispatchTransport(intent).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logDesktopUi("ERROR", `[s4] seek transport failed (${intent.source}): ${msg}`);
      });
    },
    [dispatchTransport],
  );

  const seek = useCallback(
    (timeSec: number) => {
      // Waveform click / overlay seek during global play: suppress follow so
      // center/edge scroll does not chase a mix of old fractional offset + new time.
      runSeekTransport({
        kind: "seek",
        timeSec,
        source: "segmentSelect",
        suppressFollow: true,
      });
    },
    [runSeekTransport],
  );

  const seekBlankToTime = useCallback(
    (timeSec: number) => {
      segmentPlayback.beginGlobalPlayback();
      segmentPlayback.armBlankGlobalSpace();
      runSeekTransport({
        kind: "seek",
        timeSec,
        source: "blankTap",
        suppressFollow: true,
      });
    },
    [runSeekTransport, segmentPlayback],
  );

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const base = playback.getPlayheadTime();
      runSeekTransport({
        kind: "seek",
        timeSec: base + deltaSec,
        source: "keyboardFrame",
      });
    },
    [playback, runSeekTransport],
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
