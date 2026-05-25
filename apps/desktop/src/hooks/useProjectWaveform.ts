import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { COLORS } from "../config/tokens";
import type { SegmentDto } from "../tauri/projectApi";
import { formatMediaTime } from "../utils/formatMediaTime";
import { waveformBoundsSignature } from "../utils/boundsSignature";
import { segmentsUidSignature } from "../utils/segmentUid";
import { resolveWaveformRulerView, type WaveformRulerView } from "../utils/waveformViewport";
import { useWaveformHeightSync } from "./useWaveformHeightSync";
import { useWaveformPlayback } from "./useWaveformPlayback";
import { useWaveformRegions } from "./useWaveformRegions";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import { useWaveformZoomSync } from "./useWaveformZoomSync";

export type UseProjectWaveformOptions = {
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  disabled?: boolean;
  /** 与解语式横向时间轴对齐：像素/秒，需与 UI 轨宽计算一致 */
  minPxPerSec?: number;
  /** 波形区纵向高度（px），与外层容器一致；变更时 `setOptions({ height })` */
  waveformHeightPx?: number;
  /** 波形真实重绘完成后，将已应用高度回传给外层预览层。 */
  onWaveformHeightApplied?: (heightPx: number) => void;
  onSelectIndex: (idx: number) => void;
  /** Single undo entry: segment time bounds after drag/resize. */
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  /** 在波形空白处拖选新建语段；启用时会关闭 dragToSeek 以免抢同一套水平拖动 */
  onWaveformCreateRange?: (startSec: number, endSec: number) => void;
  /** 波形内部横向滚动（与外层时间轴滚动条对齐，思路来自解语 waveform ↔ tier scroll sync） */
  onWaveformScroll?: (scrollLeftPx: number) => void;
  /** 当前可见视口横向滚动偏移；若外层容器也参与横向滚动，用于命中换算对齐。 */
  getViewportScrollPx?: () => number;
};

export function useProjectWaveform(options: UseProjectWaveformOptions) {
  const {
    mediaUrl,
    segments,
    selectedIdx,
    disabled,
    minPxPerSec = 56,
    waveformHeightPx = 96,
    onWaveformCreateRange,
  } = options;
  const optsRef = useRef(options);
  optsRef.current = options;
  const minPxPerSecRef = useRef(minPxPerSec);
  minPxPerSecRef.current = minPxPerSec;
  const waveformHeightRef = useRef(waveformHeightPx);
  waveformHeightRef.current = waveformHeightPx;
  const appliedWaveformHeightRef = useRef(waveformHeightPx);
  const pendingAppliedWaveformHeightRef = useRef<number | null>(waveformHeightPx);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const wsUnsubsRef = useRef<Array<() => void>>([]);
  const lastTimeUiCommitRef = useRef(-1);
  const zoomRafRef = useRef(0);
  const appliedZoomPxPerSecRef = useRef(minPxPerSec);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rulerView, setRulerView] = useState<WaveformRulerView | null>(null);
  const playback = useWaveformPlayback(
    wsRef,
    containerRef,
    isReady,
    minPxPerSecRef,
    options.getViewportScrollPx,
  );
  const boundsSig = waveformBoundsSignature(segments);
  const uidSig = segmentsUidSignature(segments);
  const clearWsListeners = useCallback(() => {
    wsUnsubsRef.current.forEach((u) => u());
    wsUnsubsRef.current = [];
  }, []);
  const { clearRegionListeners } = useWaveformRegions(
    wsRef,
    regionsRef,
    optsRef,
    isReady,
    disabled,
    boundsSig,
    uidSig,
    selectedIdx,
    onWaveformCreateRange,
  );
  const segmentPlayback = useWaveformSegmentPlaybackControls({
    wsRef,
    regionsRef,
    isReady,
    segments,
    selectedIdx,
  });

  const destroyWave = useCallback(() => {
    clearRegionListeners();
    regionsRef.current?.clearRegions();
    regionsRef.current = null;
    clearWsListeners();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.destroy();
      } catch {
        /* noop */
      }
    }
    setIsReady(false);
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    setRulerView(null);
    pendingAppliedWaveformHeightRef.current = null;
    if (zoomRafRef.current) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = 0;
    }
  }, [clearRegionListeners, clearWsListeners]);

  useEffect(() => {
    destroyWave();
    if (!mediaUrl) {
      setLoadError(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const run = async () => {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      if (disposed) return;
      const el = containerRef.current;
      if (!el?.isConnected) return;

      const regions = RegionsPlugin.create();
      regionsRef.current = regions;

      const wantDragCreate = Boolean(optsRef.current.onWaveformCreateRange);
      const initialMps = minPxPerSecRef.current;
      const initialH = waveformHeightRef.current;
      pendingAppliedWaveformHeightRef.current = initialH;
      appliedZoomPxPerSecRef.current = initialMps;
      const ws = WaveSurfer.create({
        container: el,
        url: mediaUrl,
        height: initialH,
        normalize: true,
        waveColor: COLORS.waveformWave,
        progressColor: COLORS.waveformProgress,
        cursorColor: COLORS.waveformCursor,
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        minPxPerSec: initialMps,
        dragToSeek: !wantDragCreate,
        interact: !optsRef.current.disabled,
        autoScroll: true,
        autoCenter: false,
        plugins: [regions],
      });

      wsRef.current = ws;

      wsUnsubsRef.current.push(
        ws.on("ready", (d) => {
          if (disposed) return;
          setLoadError(null);
          setIsReady(true);
          setDuration(d);
          setRulerView(
            resolveWaveformRulerView({
              durationSec: d,
              scrollLeftPx: ws.getScroll(),
              clientWidthPx: ws.getWidth(),
              pxPerSec: minPxPerSecRef.current,
            }),
          );
        }),
      );
      wsUnsubsRef.current.push(
        ws.on("error", (err) => {
          if (disposed) return;
          setLoadError(err.message || String(err));
          setIsReady(false);
        }),
      );
      wsUnsubsRef.current.push(ws.on("play", () => setIsPlaying(true)));
      wsUnsubsRef.current.push(ws.on("pause", () => setIsPlaying(false)));
      wsUnsubsRef.current.push(ws.on("finish", () => setIsPlaying(false)));
      wsUnsubsRef.current.push(
        ws.on("timeupdate", (t) => {
          if (disposed) return;
          if (ws.isPlaying()) {
            if (Math.abs(t - lastTimeUiCommitRef.current) < 0.12) return;
          }
          lastTimeUiCommitRef.current = t;
          setCurrentTime(t);
        }),
      );
      wsUnsubsRef.current.push(
        ws.on("seeking", (t) => {
          if (disposed) return;
          lastTimeUiCommitRef.current = t;
          setCurrentTime(t);
        }),
      );
      wsUnsubsRef.current.push(
        ws.on("scroll", (visibleStartTime, visibleEndTime, scrollLeft) => {
          if (disposed) return;
          setRulerView({ start: visibleStartTime, end: visibleEndTime });
          optsRef.current.onWaveformScroll?.(scrollLeft);
        }),
      );
      wsUnsubsRef.current.push(
        ws.on("zoom", () => {
          if (disposed) return;
          optsRef.current.onWaveformScroll?.(ws.getScroll());
          setRulerView(
            resolveWaveformRulerView({
              durationSec: ws.getDuration() || 0,
              scrollLeftPx: ws.getScroll(),
              clientWidthPx: ws.getWidth(),
              pxPerSec: minPxPerSecRef.current,
            }),
          );
        }),
      );
      wsUnsubsRef.current.push(
        ws.on("redrawcomplete", () => {
          if (disposed) return;
          const appliedHeight = pendingAppliedWaveformHeightRef.current;
          if (appliedHeight == null) return;
          pendingAppliedWaveformHeightRef.current = null;
          appliedWaveformHeightRef.current = appliedHeight;
          optsRef.current.onWaveformHeightApplied?.(appliedHeight);
        }),
      );
    };

    setLoadError(null);
    void run();

    return () => {
      disposed = true;
      destroyWave();
    };
  }, [mediaUrl, destroyWave]);

  useWaveformZoomSync({
    wsRef,
    isReady,
    disabled,
    minPxPerSec,
    zoomRafRef,
    appliedZoomPxPerSecRef,
  });

  useWaveformHeightSync({
    wsRef,
    containerRef,
    waveformHeightPx,
    isReady,
    disabled,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
  });

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    ws.toggleInteraction(!disabled);
  }, [disabled, isReady]);

  return {
    containerRef,
    isReady,
    loadError,
    isPlaying,
    duration,
    currentTime,
    rulerView,
    ...playback,
    ...segmentPlayback,
    formatMediaTime,
    destroyWave,
  };
}
