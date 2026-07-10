import { useEffect } from "react";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import WaveSurfer from "wavesurfer.js";
import { readWaveformSurferPalette } from "../utils/waveformThemeColors";
import { WAVEFORM_SURFER_BAR_DISPLAY } from "../config/waveformSurferDisplay";
import {
  clampPxPerSecForWaveSurferRender,
} from "../utils/pxPerSec";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import {
  markAppliedPeaks,
  markAppliedZoomWs,
  resetAppliedPeaks,
} from "../utils/waveformAppliedZoom";
import { WAVEFORM_DECODE_SAMPLE_RATE } from "../services/waveform/waveformZoomSyncEngine";
import { installWaveSurferProgressAbortWarnFilter } from "../services/waveform/waveSurferProgressAbortWarn";
import {
  applyWaveSurferProgressWithoutClip,
} from "../services/waveform/waveformSurferProgressCoverage";
import {
  logWaveformRenderPath,
  resetWaveformRenderPathLog,
} from "../services/waveform/waveformRuntimePath";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import { bindProjectWaveformWaveSurferEvents } from "./projectWaveformWaveSurferEvents";
import { logDesktopUi } from "../services/desktopUiLog";
import { logRuntimeParity } from "../services/runtimeParity";
import { probeWaveformAssetFetchParity } from "../services/waveform/waveformAssetFetchParity";
import {
  applyWaveSurferShadowCspNonce,
  withWaveSurferCspNonce,
} from "../utils/waveSurferShadowCspNonce";
import {
  waitForWaveformContainer,
  type ProjectWaveformMountRefs,
} from "./projectWaveformMountSupport";
import { buildWaveSurferMediaOnlyStubPeaks } from "../services/waveform/collapseWaveSurferToMediaOnly";

installWaveSurferProgressAbortWarnFilter();

export function useProjectWaveformMount(
  mediaUrl: string | null | undefined,
  mediaDiskPath: string | null | undefined,
  deferDecodeMount: boolean,
  refs: ProjectWaveformMountRefs,
  destroyWave: () => void,
) {
  const {
    optsRef,
    containerRef,
    wsRef,
    wsUnsubsRef,
    minPxPerSecRef,
    peakCacheRef,
    layoutDurationSecRef,
    waveformHeightRef,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
    appliedZoom,
    syncTierScrollAfterRenderRef,
    getTierScrollLeftPxRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    scrollNotifyRafRef,
    pendingScrollLeftRef,
    setLoadError,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
  } = refs;

  useEffect(() => {
    destroyWave();
    resetWaveformRenderPathLog();
    if (!mediaUrl) {
      setLoadError(null);
      return;
    }
    if (deferDecodeMount) {
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const run = async () => {
      const el = await waitForWaveformContainer(() => containerRef.current, () => disposed);
      if (disposed) return;
      if (!el) {
        logDesktopUi("WARN", "waveform mount: container not connected after wait");
        setLoadError("波形容器未就绪，请切换文件或重新打开项目");
        return;
      }

      const wantDragCreate = Boolean(optsRef.current.onWaveformCreateRange);
      const cache = peakCacheRef.current;
      const layoutDur = resolveLayoutDurationSec({
        layoutDurationSecRef: layoutDurationSecRef.current,
        peakCacheDurationSec: cache?.durationSec ?? 0,
      });
      const initialMps =
        layoutDur > 0
          ? clampPxPerSecForWaveSurferRender(minPxPerSecRef.current, layoutDur)
          : minPxPerSecRef.current;
      const initialH = waveformHeightRef.current;
      pendingAppliedWaveformHeightRef.current = initialH;
      markAppliedZoomWs(appliedZoom, initialMps);

      let peaks: Array<Float32Array | number[]> | undefined;
      let duration: number | undefined;
      // WS-2b: Rushi viewport canvas owns display — never bootstrap full peaks into WS.
      if (layoutDur > 0) {
        peaks = buildWaveSurferMediaOnlyStubPeaks();
        duration = layoutDur;
        markAppliedPeaks(appliedZoom, true, 0, layoutDur);
        logWaveformRenderPath(
          "peaks",
          "mount_media_only",
          `stub_peaks dur=${layoutDur.toFixed(1)}`,
        );
      } else {
        resetAppliedPeaks(appliedZoom);
        logWaveformRenderPath(
          "decode",
          cache ? "mount_decode_no_cache" : "mount_decode_no_cache",
          cache ? "cache_empty_layout" : "no_peak_cache",
        );
      }

      if (disposed) return;
      const mountEl = containerRef.current;
      if (!mountEl?.isConnected) return;

      setCspLayoutRules(mountEl, {
        width: "100%",
        transform: "translateX(0px)",
      });

      const wfPalette = readWaveformSurferPalette();
      const ws = WaveSurfer.create(
        withWaveSurferCspNonce({
          container: mountEl,
          url: mediaUrl,
          peaks,
          duration,
          height: initialH,
          normalize: true,
          maxPeak: 1,
          sampleRate: peaks ? undefined : WAVEFORM_DECODE_SAMPLE_RATE,
          waveColor: wfPalette.waveColor,
          progressColor: wfPalette.progressColor,
          cursorColor: wfPalette.cursorColor,
          cursorWidth: 0,
          ...WAVEFORM_SURFER_BAR_DISPLAY,
          minPxPerSec: 0,
          dragToSeek: !wantDragCreate,
          interact: !optsRef.current.disabled,
          autoScroll: false,
          autoCenter: false,
          hideScrollbar: true,
          fillParent: true,
        }),
      );
      applyWaveSurferShadowCspNonce(mountEl);

      wsRef.current = ws;
      // WS-2b: skip tier-scroll / played-region patches — Rushi owns viewport + playhead.
      if (mediaUrl && !mediaDiskPath) {
        logRuntimeParity("waveform", "mount_parity_probe_skipped no_mediaDiskPath", "WARN");
      }

      wsUnsubsRef.current.push(
        ...bindProjectWaveformWaveSurferEvents({
          ws,
          disposed: () => disposed,
          mediaUrl,
          mediaDiskPath,
          optsRef,
          minPxPerSecRef,
          lastTimeUiCommitRef,
          lastTimeUiCommitMsRef,
          pendingScrollLeftRef,
          scrollNotifyRafRef,
          pendingAppliedWaveformHeightRef,
          appliedWaveformHeightRef,
          syncTierScrollAfterRenderRef,
          setLoadError,
          setIsReady,
          setIsPlaying,
          setDuration,
          setCurrentTime,
        }),
      );

      if (peaks && mediaUrl) {
        void probeWaveformAssetFetchParity("mount_peaks_bootstrap", mediaDiskPath, mediaUrl);
      }
    };

    setLoadError(null);
    void run();

    return () => {
      disposed = true;
      destroyWave();
    };
  }, [
    mediaUrl,
    mediaDiskPath,
    deferDecodeMount,
    destroyWave,
    optsRef,
    containerRef,
    wsRef,
    wsUnsubsRef,
    minPxPerSecRef,
    peakCacheRef,
    layoutDurationSecRef,
    waveformHeightRef,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
    appliedZoom,
    syncTierScrollAfterRenderRef,
    getTierScrollLeftPxRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    scrollNotifyRafRef,
    pendingScrollLeftRef,
    setLoadError,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
  ]);

  useEffect(() => {
    return subscribeAppAppearance(() => {
      const ws = wsRef.current;
      if (!ws) return;
      const palette = readWaveformSurferPalette();
      ws.setOptions({
        waveColor: palette.waveColor,
        progressColor: palette.progressColor,
        cursorColor: palette.cursorColor,
      });
      const duration = ws.getDuration();
      if (duration > 0) {
        applyWaveSurferProgressWithoutClip(ws, ws.getCurrentTime() / duration);
      }
    });
  }, [wsRef]);
}
