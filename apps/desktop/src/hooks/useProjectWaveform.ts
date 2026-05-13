import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";
import type { SegmentDto } from "../tauri/p1Api";
import { formatMediaTime } from "../utils/formatMediaTime";
import { p1WaveformBoundsSignature, roundSec3 } from "../utils/p1BoundsSignature";
import { p1WaveformRegionFillColor } from "../utils/p1SegmentChrome";

const REGION_ID_PREFIX = "rushi-seg-";

export function segmentRegionId(index: number): string {
  return `${REGION_ID_PREFIX}${index}`;
}

export function parseSegmentRegionId(id: string): number | null {
  if (!id.startsWith(REGION_ID_PREFIX)) return null;
  const n = Number(id.slice(REGION_ID_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

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
  const regionUnsubsRef = useRef<Array<() => void>>([]);
  const isDraggingRef = useRef(false);
  /** 正在程序化同步 regions，忽略此期间的 region update-end，防止 setState 反馈环。 */
  const syncingRegionsRef = useRef(false);
  const lastTimeUiCommitRef = useRef(-1);
  const prevSelectedIdxForColorRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const boundsSig = useMemo(() => p1WaveformBoundsSignature(segments), [segments]);

  const clearWsListeners = useCallback(() => {
    wsUnsubsRef.current.forEach((u) => u());
    wsUnsubsRef.current = [];
  }, []);

  const clearRegionListeners = useCallback(() => {
    regionUnsubsRef.current.forEach((u) => u());
    regionUnsubsRef.current = [];
  }, []);

  const destroyWave = useCallback(() => {
    syncingRegionsRef.current = false;
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
    prevSelectedIdxForColorRef.current = null;
  }, [clearRegionListeners, clearWsListeners]);

  const bindSegmentRegion = useCallback(
    (ws: WaveSurfer, region: Region, i: number) => {
      let boundsLiveRaf = 0;
      const flushBoundsLive = () => {
        boundsLiveRaf = 0;
        if (syncingRegionsRef.current) return;
        if (wsRef.current !== ws) return;
        const live = optsRef.current.onBoundsLive;
        if (!live) return;
        const lo = Math.min(region.start, region.end);
        const hi = Math.max(region.start, region.end);
        const dur = ws.getDuration() || hi;
        const clampedStart = roundSec3(Math.max(0, lo));
        const clampedEnd = roundSec3(Math.min(Math.max(clampedStart + 0.05, hi), dur));
        live(i, clampedStart, clampedEnd);
      };
      const scheduleBoundsLive = () => {
        if (boundsLiveRaf) return;
        boundsLiveRaf = requestAnimationFrame(flushBoundsLive);
      };
      const onUpdate = () => {
        if (syncingRegionsRef.current) return;
        isDraggingRef.current = true;
        if (optsRef.current.onBoundsLive) scheduleBoundsLive();
      };
      const onUpdateEnd = () => {
        if (boundsLiveRaf) {
          cancelAnimationFrame(boundsLiveRaf);
          boundsLiveRaf = 0;
        }
        isDraggingRef.current = false;
        if (syncingRegionsRef.current) return;
        const lo = Math.min(region.start, region.end);
        const hi = Math.max(region.start, region.end);
        const dur = ws.getDuration() || hi;
        const clampedStart = roundSec3(Math.max(0, lo));
        const clampedEnd = roundSec3(Math.min(Math.max(clampedStart + 0.05, hi), dur));
        optsRef.current.onBoundsCommit(i, clampedStart, clampedEnd);
      };
      const onClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        optsRef.current.onSelectIndex(i);
        ws.setTime(region.start);
      };
      const onDbl = (ev: MouseEvent) => {
        ev.stopPropagation();
        optsRef.current.onSelectIndex(i);
        void region.play(true);
      };

      region.on("update", onUpdate);
      region.on("update-end", onUpdateEnd);
      region.on("click", onClick);
      region.on("dblclick", onDbl);

      regionUnsubsRef.current.push(() => {
        if (boundsLiveRaf) cancelAnimationFrame(boundsLiveRaf);
        region.un("update", onUpdate);
        region.un("update-end", onUpdateEnd);
        region.un("click", onClick);
        region.un("dblclick", onDbl);
      });
    },
    [],
  );

  const rebuildAllSegmentRegions = useCallback(
    (ws: WaveSurfer, rp: ReturnType<typeof RegionsPlugin.create>) => {
      clearRegionListeners();
      rp.clearRegions();
      const segs = optsRef.current.segments;
      segs.forEach((seg, i) => {
        const id = segmentRegionId(i);
        const start = Math.max(0, seg.start_sec);
        const end = Math.max(start + 0.04, seg.end_sec);
        const primary = i === optsRef.current.selectedIdx;
        const region = rp.addRegion({
          id,
          start,
          end,
          drag: true,
          resize: true,
          minLength: 0.05,
          color: p1WaveformRegionFillColor(seg, primary),
        });
        bindSegmentRegion(ws, region, i);
      });
    },
    [bindSegmentRegion, clearRegionListeners],
  );

  /** Create / replace WaveSurfer when mediaUrl changes（缩放走 ws.zoom，不重建实例）。 */
  useEffect(() => {
    destroyWave();
    if (!mediaUrl || disabled) {
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

      const wantDragCreate = Boolean(onWaveformCreateRange);
      const initialMps = minPxPerSecRef.current;
      const initialH = waveformHeightRef.current;
      const ws = WaveSurfer.create({
        container: el,
        url: mediaUrl,
        height: initialH,
        normalize: true,
        waveColor: "#c4c4c8",
        progressColor: "#8e8e93",
        cursorColor: "#6a6a6f",
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        minPxPerSec: initialMps,
        dragToSeek: !wantDragCreate,
        interact: !disabled,
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
  }, [mediaUrl, disabled, destroyWave, onWaveformCreateRange]);

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
      el.style.backgroundColor = "#ffffff";
    }
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    try {
      ws.setOptions({
        height: h,
        waveColor: "#c4c4c8",
        progressColor: "#8e8e93",
        cursorColor: "#6a6a6f",
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
    if (!ws || !isReady || disabled) return;
    ws.toggleInteraction(!disabled);
  }, [disabled, isReady]);

  /** 语段 regions：段数或 id 映射变化时全量重建；仅起止/低置信变化时增量 setOptions。 */
  useEffect(() => {
    const ws = wsRef.current;
    const rp = regionsRef.current;
    if (!ws || !rp || !isReady || disabled) return;
    if (isDraggingRef.current) return;

    const segs = optsRef.current.segments;
    const regs = rp.getRegions();
    const byId = new Map(regs.map((r) => [r.id, r]));

    let needFull = segs.length !== byId.size;
    if (!needFull) {
      for (let i = 0; i < segs.length; i++) {
        if (!byId.has(segmentRegionId(i))) {
          needFull = true;
          break;
        }
      }
    }
    if (!needFull) {
      for (const r of regs) {
        const idx = parseSegmentRegionId(r.id);
        if (idx == null || idx >= segs.length) {
          needFull = true;
          break;
        }
      }
    }

    syncingRegionsRef.current = true;
    const rafIds = { a: 0, b: 0 };

    if (needFull) {
      rebuildAllSegmentRegions(ws, rp);
    } else {
      const sel = optsRef.current.selectedIdx;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const id = segmentRegionId(i);
        const r = byId.get(id);
        if (!r) {
          rebuildAllSegmentRegions(ws, rp);
          break;
        }
        const start = Math.max(0, seg.start_sec);
        const end = Math.max(start + 0.04, seg.end_sec);
        r.setOptions({
          start,
          end,
          color: p1WaveformRegionFillColor(seg, i === sel),
        });
      }
    }

    rafIds.a = requestAnimationFrame(() => {
      rafIds.b = requestAnimationFrame(() => {
        syncingRegionsRef.current = false;
      });
    });

    return () => {
      cancelAnimationFrame(rafIds.a);
      cancelAnimationFrame(rafIds.b);
      syncingRegionsRef.current = false;
    };
  }, [boundsSig, segments.length, isReady, disabled, rebuildAllSegmentRegions]);

  /** 波形空白处拖选 → 新建语段（Regions enableDragSelection） */
  useEffect(() => {
    const ws = wsRef.current;
    const rp = regionsRef.current;
    if (!ws || !rp || !isReady || disabled) return;
    const onCreate = optsRef.current.onWaveformCreateRange;
    if (!onCreate) return;

    const disableDragSelection = rp.enableDragSelection({
      color: "rgba(0,0,0,0.07)",
    });

    const onRegionCreated = (region: { id: string; start: number; end: number; remove: () => void }) => {
      if (String(region.id).startsWith(REGION_ID_PREFIX)) return;
      if (optsRef.current.disabled) {
        try {
          region.remove();
        } catch {
          /* noop */
        }
        return;
      }
      const lo = Math.min(region.start, region.end);
      const hi = Math.max(region.start, region.end);
      try {
        region.remove();
      } catch {
        /* noop */
      }
      onCreate(lo, hi);
    };

    const unsub = rp.on("region-created", onRegionCreated);

    return () => {
      unsub();
      disableDragSelection();
    };
  }, [isReady, disabled, mediaUrl, onWaveformCreateRange]);

  /** 仅选中变化：只改旧/新两条 region 颜色，避免 getRegions 全表 setOptions。 */
  useEffect(() => {
    const rp = regionsRef.current;
    if (!rp || !isReady || disabled) return;
    const liveSegs = optsRef.current.segments;
    const prev = prevSelectedIdxForColorRef.current;
    prevSelectedIdxForColorRef.current = selectedIdx;

    const paint = (idx: number | null) => {
      if (idx == null || idx < 0 || idx >= liveSegs.length) return;
      const id = segmentRegionId(idx);
      const r = rp.getRegions().find((x) => x.id === id);
      if (!r) return;
      const seg = liveSegs[idx];
      r.setOptions({ color: p1WaveformRegionFillColor(seg, idx === selectedIdx) });
    };

    if (prev !== null && prev !== selectedIdx) paint(prev);
    paint(selectedIdx);
  }, [selectedIdx, isReady, disabled]);

  const seek = useCallback((timeSec: number) => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    const d = ws.getDuration() || 0;
    ws.setTime(Math.max(0, Math.min(timeSec, d > 0 ? d : timeSec)));
  }, [isReady]);

  const togglePlay = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    if (ws.isPlaying()) ws.pause();
    else await ws.play();
  }, [isReady]);

  const getScrollLeft = useCallback((): number => {
    const ws = wsRef.current;
    if (!ws || !isReady) return 0;
    return ws.getScroll();
  }, [isReady]);

  const setScrollLeft = useCallback(
    (pixels: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      ws.setScroll(pixels);
    },
    [isReady],
  );

  const getPlayheadTime = useCallback((): number => {
    const ws = wsRef.current;
    if (!ws || !isReady) return 0;
    return ws.getCurrentTime();
  }, [isReady]);

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      ws.skip(deltaSec);
    },
    [isReady],
  );

  const clientXToTimeSec = useCallback(
    (clientX: number): number => {
      const ws = wsRef.current;
      const el = containerRef.current;
      if (!ws || !el || !isReady) return 0;
      const rect = el.getBoundingClientRect();
      const relPx = clientX - rect.left + ws.getScroll();
      const mps = optsRef.current.minPxPerSec ?? 56;
      const dur = ws.getDuration() || 0;
      const t = relPx / mps;
      return Math.max(0, Math.min(t, dur));
    },
    [isReady],
  );

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
    seek,
    togglePlay,
    getScrollLeft,
    setScrollLeft,
    getPlayheadTime,
    seekByDelta,
    clientXToTimeSec,
    playSegmentAtIndex,
    formatMediaTime,
    destroyWave,
  };
}
