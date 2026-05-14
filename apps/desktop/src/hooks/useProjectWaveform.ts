import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { COLORS } from "../config/tokens";
import type { SegmentDto } from "../tauri/projectApi";
import { formatMediaTime } from "../utils/formatMediaTime";
import { waveformBoundsSignature } from "../utils/boundsSignature";
import { parseSegmentRegionId } from "../utils/waveformRegionId";
import { useWaveformPlayback } from "./useWaveformPlayback";
import { useWaveformRegions } from "./useWaveformRegions";

export type UseProjectWaveformOptions = {
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  disabled?: boolean;
  /** 与解语式横向时间轴对齐：像素/秒，需与 UI 轨宽计算一致 */
  minPxPerSec?: number;
  /** 波形区纵向高度（px），与外层容器一致；变更时 `setOptions({ height })` */
  waveformHeightPx?: number;
  onSelectIndex: (idx: number) => void;
  /** Single undo entry: segment time bounds after drag/resize. */
  onBoundsCommit: (idx: number, startSec: number, endSec: number) => void;
  /** 拖拽/resize 过程中同步下方时间轨语段卡（每帧至多一次 RAF）。 */
  onBoundsLive?: (idx: number, startSec: number, endSec: number) => void;
  /** 在波形空白处拖选新建语段；启用时会关闭 dragToSeek 以免抢同一套水平拖动 */
  onWaveformCreateRange?: (startSec: number, endSec: number) => void;
  /** 波形内部横向滚动（与外层时间轴滚动条对齐，思路来自解语 waveform ↔ tier scroll sync） */
  onWaveformScroll?: (scrollLeftPx: number) => void;
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const wsUnsubsRef = useRef<Array<() => void>>([]);
  const lastTimeUiCommitRef = useRef(-1);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const playback = useWaveformPlayback(wsRef, containerRef, isReady, minPxPerSecRef);

  const boundsSig = useMemo(() => waveformBoundsSignature(segments), [segments]);

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
    selectedIdx,
    onWaveformCreateRange,
  );

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
  }, [clearRegionListeners, clearWsListeners]);

  /** Create / replace WaveSurfer when mediaUrl changes（缩放走 ws.zoom，不重建实例）。 */
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
        ws.on("scroll", () => {
          if (disposed) return;
          optsRef.current.onWaveformScroll?.(ws.getScroll());
        }),
      );
      wsUnsubsRef.current.push(
        ws.on("zoom", () => {
          if (disposed) return;
          optsRef.current.onWaveformScroll?.(ws.getScroll());
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

  /** 仅缩放：不销毁 WaveSurfer。 */
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    try {
      ws.zoom(minPxPerSec);
    } catch {
      /* noop */
    }
  }, [minPxPerSec, isReady, disabled]);

  /** 波形纵向高度 + 白底灰度样式（不重建实例）。 */
  useEffect(() => {
    const el = containerRef.current;
    const h = waveformHeightPx;
    if (el) {
      el.style.height = `${h}px`;
      el.style.backgroundColor = COLORS.waveformSurface;
    }
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    try {
      ws.setOptions({
        height: h,
        waveColor: COLORS.waveformWave,
        progressColor: COLORS.waveformProgress,
        cursorColor: COLORS.waveformCursor,
      });
    } catch {
      try {
        ws.setOptions({ height: h });
      } catch {
        /* noop */
      }
    }
  }, [waveformHeightPx, isReady, disabled]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    ws.toggleInteraction(!disabled);
  }, [disabled, isReady]);

  const playSegmentAtIndex = useCallback(
    (idx: number) => {
      const rp = regionsRef.current;
      if (!rp || !isReady) return;
      const regs = rp.getRegions();
      const r = regs.find((x) => parseSegmentRegionId(x.id) === idx);
      if (!r) return;
      r.play(true);
    },
    [isReady],
  );

  return {
    containerRef,
    isReady,
    loadError,
    isPlaying,
    duration,
    currentTime,
    ...playback,
    playSegmentAtIndex,
    formatMediaTime,
    destroyWave,
  };
}
