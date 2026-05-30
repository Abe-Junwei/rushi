import type { MutableRefObject, RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { PeakCache } from "./PeakCache";
import { isWaveSurferAbortError } from "./waveSurferProgressAbortWarn";
import {
  appliedZoomMatchesIntent,
  isPeaksLoadedIntoWs,
  markAppliedZoomWs,
  readLoadedPeaksPx,
  resetAppliedPeaks,
  type WaveformAppliedZoomState,
} from "../../utils/waveformAppliedZoom";
import { quantizePxPerSecForPeaksLoad, shouldZoomOnlyForSubMinFitAllRefit } from "../../utils/pxPerSec";
import { resolveLayoutDurationSec } from "../../utils/waveformTimelineMetrics";

export const WAVEFORM_DECODE_SAMPLE_RATE = 8000;

export type WaveformZoomSyncInFlight = {
  zoomSyncInFlightRef: MutableRefObject<number | null>;
  peaksLoadSeqRef: MutableRefObject<number>;
  peaksLoadInFlightPxRef: MutableRefObject<number | null>;
};

export type ZoomApplyAction =
  | { type: "noop" }
  | { type: "finish-zoom" }
  | { type: "load-peaks"; loadPeaksPx: number; layoutDur: number }
  | { type: "defer-hot-switch" }
  | { type: "defer-resize-load"; loadPeaksPx: number; layoutDur: number };

export function disableWaveSurferAutoScroll(ws: WaveSurfer): void {
  try {
    ws.setOptions({ autoScroll: false });
  } catch {
    /* noop */
  }
}

export function planWaveformZoomApply(input: {
  intentPxPerSec: number;
  appliedZoom: WaveformAppliedZoomState;
  peakCache: PeakCache | null | undefined;
  mediaUrl: string | null | undefined;
  layoutDurationSecRef?: number;
  layoutDurationSec: number;
  peakCacheDurationSec?: number;
  isPlaying: boolean;
  hotSwitchWhilePlaying: boolean;
  peaksLoadInFlight: boolean;
  viewportResizeHold: boolean;
}): ZoomApplyAction {
  const loadPeaksPx = quantizePxPerSecForPeaksLoad(input.intentPxPerSec);

  if (!input.peakCache || !input.mediaUrl) {
    return { type: "finish-zoom" };
  }

  const layoutDur = resolveLayoutDurationSec({
    layoutDurationSecRef: input.layoutDurationSecRef,
    layoutDurationSec: input.layoutDurationSec,
    peakCacheDurationSec: input.peakCacheDurationSec,
  });
  if (layoutDur <= 0) {
    return { type: "finish-zoom" };
  }

  const loadedPeaksPx = readLoadedPeaksPx(input.appliedZoom);
  const peaksLoaded = isPeaksLoadedIntoWs(input.appliedZoom);

  if (
    shouldZoomOnlyForSubMinFitAllRefit({
      requestedPeaksPxPerSec: loadPeaksPx,
      loadedPeaksPxPerSec: loadedPeaksPx,
      peaksLoadedIntoWaveSurfer: peaksLoaded,
      peaksLoadInFlight: input.peaksLoadInFlight,
    })
  ) {
    return { type: "finish-zoom" };
  }

  const peaksAlreadyLoaded = peaksLoaded && loadedPeaksPx === loadPeaksPx;
  if (peaksAlreadyLoaded && appliedZoomMatchesIntent(input.appliedZoom, input.intentPxPerSec)) {
    return { type: "noop" };
  }
  if (peaksAlreadyLoaded) {
    return { type: "finish-zoom" };
  }

  if (!input.hotSwitchWhilePlaying && input.isPlaying) {
    return { type: "defer-hot-switch" };
  }

  if (input.viewportResizeHold) {
    return { type: "defer-resize-load", loadPeaksPx, layoutDur };
  }

  return { type: "load-peaks", loadPeaksPx, layoutDur };
}

export function commitWaveSurferZoom(input: {
  ws: WaveSurfer;
  intentPxPerSec: number;
  appliedZoom: WaveformAppliedZoomState;
  inFlight: WaveformZoomSyncInFlight;
  onZoomApplied?: (pxPerSec: number) => boolean | void;
}): void {
  const { ws, intentPxPerSec, appliedZoom, inFlight, onZoomApplied } = input;
  if (inFlight.zoomSyncInFlightRef.current !== null && inFlight.zoomSyncInFlightRef.current !== intentPxPerSec) {
    return;
  }
  try {
    if (!appliedZoomMatchesIntent(appliedZoom, intentPxPerSec)) {
      ws.zoom(intentPxPerSec);
    }
    markAppliedZoomWs(appliedZoom, intentPxPerSec);
    onZoomApplied?.(intentPxPerSec);
  } catch {
    /* noop */
  } finally {
    if (inFlight.zoomSyncInFlightRef.current === intentPxPerSec) {
      inFlight.zoomSyncInFlightRef.current = null;
    }
  }
}

export function loadPeaksIntoWaveSurfer(input: {
  ws: WaveSurfer;
  cache: PeakCache;
  url: string;
  loadPeaksPx: number;
  layoutDur: number;
  intentPxPerSec: number;
  mediaUrl: string | null | undefined;
  wsRef: RefObject<WaveSurfer | null>;
  appliedZoom: WaveformAppliedZoomState;
  inFlight: WaveformZoomSyncInFlight;
  onZoomApplied?: (pxPerSec: number) => boolean | void;
  onPeaksApplied: (applied: boolean, loadPeaksPx: number) => void;
}): void {
  const {
    ws,
    cache,
    url,
    loadPeaksPx,
    layoutDur,
    intentPxPerSec,
    mediaUrl,
    wsRef,
    appliedZoom,
    inFlight,
    onZoomApplied,
    onPeaksApplied,
  } = input;

  if (inFlight.peaksLoadInFlightPxRef.current === loadPeaksPx) return;
  inFlight.peaksLoadInFlightPxRef.current = loadPeaksPx;

  const resumeTimeSec = ws.getCurrentTime();
  const resumePlaying = ws.isPlaying();
  const loadSeq = ++inFlight.peaksLoadSeqRef.current;
  inFlight.zoomSyncInFlightRef.current = intentPxPerSec;

  void cache
    .getWaveSurferPeaksAsync(loadPeaksPx, layoutDur)
    .then((bundle) => {
      if (inFlight.peaksLoadSeqRef.current !== loadSeq) return;
      if (inFlight.peaksLoadInFlightPxRef.current !== loadPeaksPx) return;
      return ws.load(url, bundle.peaks, bundle.duration).then(() => {
        if (inFlight.peaksLoadSeqRef.current !== loadSeq) return;
        if (wsRef.current !== ws) return;
        if (mediaUrl !== url) return;
        try {
          const nowTimeSec = ws.getCurrentTime();
          if (Math.abs(nowTimeSec - resumeTimeSec) < 0.5) {
            ws.setTime(resumeTimeSec);
          }
          if (resumePlaying) void ws.play().catch(() => {});
        } catch {
          /* noop */
        }
        onPeaksApplied(true, loadPeaksPx);
        commitWaveSurferZoom({
          ws,
          intentPxPerSec,
          appliedZoom,
          inFlight,
          onZoomApplied,
        });
      });
    })
    .catch((err) => {
      if (isWaveSurferAbortError(err)) return;
      if (wsRef.current !== ws) return;
      onPeaksApplied(false, Number.NaN);
      commitWaveSurferZoom({
        ws,
        intentPxPerSec,
        appliedZoom,
        inFlight,
        onZoomApplied,
      });
    })
    .finally(() => {
      if (inFlight.peaksLoadInFlightPxRef.current === loadPeaksPx) {
        inFlight.peaksLoadInFlightPxRef.current = null;
      }
    });
}

export function clearPeaksAppliedForDecode(appliedZoom: WaveformAppliedZoomState): void {
  resetAppliedPeaks(appliedZoom);
}
