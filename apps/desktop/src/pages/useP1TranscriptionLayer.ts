import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useProjectWaveform } from "../hooks/useProjectWaveform";
import type { SegmentDto } from "../tauri/p1Api";
import { p1LaneBoundsSignature } from "../utils/p1BoundsSignature";
import { clampP1PxPerSec, P1_TIMELINE_PX_PER_SEC } from "../utils/p1PxPerSec";
import {
  P1_TRANSCRIPT_FONT_DEFAULT,
  P1_WAVEFORM_HEIGHT_DEFAULT,
  clampP1TranscriptFontPx,
  clampP1WaveformHeight,
  readStoredP1TranscriptFontPx,
  readStoredP1WaveformHeightPx,
  readStoredP1WaveformPxPerSec,
  writeStoredP1TranscriptFontPx,
  writeStoredP1WaveformHeightPx,
  writeStoredP1WaveformPxPerSec,
} from "../utils/p1WaveformPrefs";

export { P1_TIMELINE_PX_PER_SEC, clampP1PxPerSec } from "../utils/p1PxPerSec";

/** 语段卡行高（px）：单行正文 + 上下内边距，随正文字号略增。 */
export function computeP1SegmentLaneRowPx(transcriptFontPx: number): number {
  const f = clampP1TranscriptFontPx(transcriptFontPx);
  const linePx = Math.ceil(f * 1.45);
  const verticalPad = 24;
  return Math.max(28, verticalPad + linePx);
}

/** 默认字号下的语段卡行高（供测试与布局常量引用）。 */
export const P1_SEGMENT_LANE_ROW_PX = computeP1SegmentLaneRowPx(P1_TRANSCRIPT_FONT_DEFAULT);

/**
 * 将语段分配到最少数量的「车道」，使时间重叠的语段不在同一车道相邻占用（贪心按开始时间排序）。
 * 用于单条时间轨上垂直错开叠放。
 */
export function assignP1SegmentOverlapLanes(
  segments: Pick<SegmentDto, "start_sec" | "end_sec">[],
): { laneByIndex: number[]; laneCount: number } {
  const n = segments.length;
  if (n === 0) return { laneByIndex: [], laneCount: 0 };

  const idxs = Array.from({ length: n }, (_, j) => j).sort((a, b) => {
    const d = segments[a].start_sec - segments[b].start_sec;
    return d !== 0 ? d : segments[a].end_sec - segments[b].end_sec;
  });

  const laneEnds: number[] = [];
  const laneByIndex = new Array<number>(n).fill(0);

  for (const i of idxs) {
    const s = segments[i];
    const lo = Math.min(s.start_sec, s.end_sec);
    const hi = Math.max(s.start_sec, s.end_sec);
    let chosen = -1;
    for (let k = 0; k < laneEnds.length; k++) {
      if (laneEnds[k] <= lo + 1e-9) {
        chosen = k;
        break;
      }
    }
    if (chosen < 0) {
      chosen = laneEnds.length;
      laneEnds.push(hi);
    } else {
      laneEnds[chosen] = hi;
    }
    laneByIndex[i] = chosen;
  }

  return { laneByIndex, laneCount: laneEnds.length };
}

/**
 * 时间轴总宽 = 媒体时长 × 像素/秒（与 WaveSurfer `minPxPerSec` 一致）。
 * 若与波形可滚宽度不一致，会导致 tier 与波形横向错位、语段卡与 region 对不齐。
 */
export function computeP1TimelineWidthPx(durationSec: number, pxPerSec: number): number {
  const floor = 320;
  const sec = Math.max(durationSec, 0.5);
  return Math.max(Math.ceil(sec * pxPerSec), floor);
}

export type P1TranscriptionLayerInput = {
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  busy: boolean;
  undo: () => void;
  redo: () => void;
  updateSegmentBounds: (idx: number, startSec: number, endSec: number, phase?: "live" | "commit") => void;
  insertSegmentFromTimeRange: (startSec: number, endSec: number) => void;
  splitAtSelection: () => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithNext: () => void;
  mergeWithPrev: () => void;
  insertSegmentAfter: (idx: number) => void;
  deleteSegmentAt: (idx: number) => void;
};

/**
 * P1 转写主舞台的单一编排层：波形 regions、时间轴宽度（仅媒体时长）、外层横向滚动 ↔ WaveSurfer 内部滚动、
 * 选中语段滚入视区、语段条工具栏入口、单轨车道布局（时间重叠则垂直错开）。
 */
export function useP1TranscriptionLayer(ctx: P1TranscriptionLayerInput) {
  const tierScrollRef = useRef<HTMLDivElement | null>(null);
  const waveformShellRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncingRef = useRef(false);
  const tierScrollLayoutRafRef = useRef(0);

  const [pxPerSec, setPxPerSecState] = useState(() => {
    const stored = readStoredP1WaveformPxPerSec();
    return stored != null ? stored : P1_TIMELINE_PX_PER_SEC;
  });

  const skipInitialPxWriteRef = useRef(true);
  useEffect(() => {
    if (skipInitialPxWriteRef.current) {
      skipInitialPxWriteRef.current = false;
      return;
    }
    writeStoredP1WaveformPxPerSec(pxPerSec);
  }, [pxPerSec]);

  const [waveformHeightPx, setWaveformHeightPxState] = useState(
    () => readStoredP1WaveformHeightPx() ?? P1_WAVEFORM_HEIGHT_DEFAULT,
  );
  const [transcriptFontPx, setTranscriptFontPxState] = useState(
    () => readStoredP1TranscriptFontPx() ?? P1_TRANSCRIPT_FONT_DEFAULT,
  );

  const waveformHeightPxRef = useRef(waveformHeightPx);
  waveformHeightPxRef.current = waveformHeightPx;

  const transcriptFontPxRef = useRef(transcriptFontPx);
  transcriptFontPxRef.current = transcriptFontPx;

  const skipInitialHWriteRef = useRef(true);
  useEffect(() => {
    if (skipInitialHWriteRef.current) {
      skipInitialHWriteRef.current = false;
      return;
    }
    writeStoredP1WaveformHeightPx(waveformHeightPx);
  }, [waveformHeightPx]);

  const skipInitialFontWriteRef = useRef(true);
  useEffect(() => {
    if (skipInitialFontWriteRef.current) {
      skipInitialFontWriteRef.current = false;
      return;
    }
    writeStoredP1TranscriptFontPx(transcriptFontPx);
  }, [transcriptFontPx]);

  const segmentLaneRowPx = useMemo(() => computeP1SegmentLaneRowPx(transcriptFontPx), [transcriptFontPx]);

  const setSelectedIdxUi = useCallback((idx: number) => {
    startTransition(() => ctx.setSelectedIdx(idx));
  }, [ctx.setSelectedIdx]);

  const wf = useProjectWaveform({
    mediaUrl: ctx.mediaUrl,
    segments: ctx.segments,
    selectedIdx: ctx.selectedIdx,
    disabled: ctx.busy,
    minPxPerSec: pxPerSec,
    waveformHeightPx,
    onSelectIndex: setSelectedIdxUi,
    onBoundsCommit: (idx, lo, hi) => ctx.updateSegmentBounds(idx, lo, hi, "commit"),
    onBoundsLive: (idx, lo, hi) => ctx.updateSegmentBounds(idx, lo, hi, "live"),
    onWaveformCreateRange: ctx.insertSegmentFromTimeRange,
    onWaveformScroll: (sl) => {
      const tier = tierScrollRef.current;
      if (!tier) return;
      if (scrollSyncingRef.current) return;
      scrollSyncingRef.current = true;
      try {
        if (Math.abs(tier.scrollLeft - sl) > 0.01) tier.scrollLeft = sl;
      } finally {
        scrollSyncingRef.current = false;
      }
    },
  });

  const wfApiRef = useRef(wf);
  wfApiRef.current = wf;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const nudgeWaveformHeight = useCallback((delta: number) => {
    setWaveformHeightPxState((h) => clampP1WaveformHeight(h + delta));
  }, []);

  const nudgeTranscriptFontPx = useCallback((delta: number) => {
    setTranscriptFontPxState((f) => clampP1TranscriptFontPx(f + delta));
  }, []);

  const beginWaveformHeightDrag = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || ctxRef.current.busy) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = waveformHeightPxRef.current;
    const onMove = (ev: PointerEvent) => {
      setWaveformHeightPxState(clampP1WaveformHeight(startH + (ev.clientY - startY)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const beginTranscriptFontDrag = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || ctxRef.current.busy) return;
    e.preventDefault();
    const startY = e.clientY;
    const startF = transcriptFontPxRef.current;
    const onMove = (ev: PointerEvent) => {
      setTranscriptFontPxState(clampP1TranscriptFontPx(startF + Math.round((ev.clientY - startY) / 5)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const zoomIn = useCallback(() => {
    setPxPerSecState((p) => clampP1PxPerSec(p * 1.12));
  }, []);

  const zoomOut = useCallback(() => {
    setPxPerSecState((p) => clampP1PxPerSec(p / 1.12));
  }, []);

  const resetZoom = useCallback(() => {
    setPxPerSecState(P1_TIMELINE_PX_PER_SEC);
  }, []);

  const zoomToFitTier = useCallback(() => {
    const tier = tierScrollRef.current;
    const dur = wf.duration || 0;
    if (!tier || dur < 0.5) return;
    const w = Math.max(160, tier.clientWidth - 12);
    setPxPerSecState(clampP1PxPerSec(w / dur));
  }, [wf.duration]);

  /** 将当前选中语段适配到视口宽度（对齐解语「适配选区」）。 */
  const zoomToFitSelection = useCallback(() => {
    const tier = tierScrollRef.current;
    const dur = wf.duration || 0;
    const c = ctxRef.current;
    const seg = c.segments[c.selectedIdx];
    if (!tier || dur < 0.5 || !seg) return;
    const span = Math.max(seg.end_sec - seg.start_sec, 0.05);
    const vw = Math.max(160, tier.clientWidth - 24);
    setPxPerSecState(clampP1PxPerSec(vw / span));
  }, [wf.duration]);

  const setPxPerSec = useCallback((next: number) => {
    setPxPerSecState(clampP1PxPerSec(next));
  }, []);

  const timelineWidthPx = useMemo(
    () => computeP1TimelineWidthPx(wf.duration || 0, pxPerSec),
    [wf.duration, pxPerSec],
  );

  const segmentToolbar = useMemo(
    () => ({
      splitAtSelection: ctx.splitAtSelection,
      mergeWithNext: ctx.mergeWithNext,
      mergeWithPrev: ctx.mergeWithPrev,
      splitDisabled: ctx.busy || ctx.segments.length === 0,
      mergeDisabled: ctx.busy || ctx.segments.length < 2 || ctx.selectedIdx >= ctx.segments.length - 1,
      mergePrevDisabled: ctx.busy || ctx.segments.length < 2 || ctx.selectedIdx <= 0,
    }),
    [ctx.busy, ctx.mergeWithNext, ctx.mergeWithPrev, ctx.segments.length, ctx.selectedIdx, ctx.splitAtSelection],
  );

  const laneBoundsSig = useMemo(() => p1LaneBoundsSignature(ctx.segments), [ctx.segments]);

  const segmentLaneLayout = useMemo(
    () => assignP1SegmentOverlapLanes(ctx.segments),
    [laneBoundsSig, ctx.segments.length],
  );

  const [tierScrollLayout, setTierScrollLayout] = useState({ scrollLeft: 0, clientWidth: 400 });

  const refreshTierScrollLayout = useCallback(() => {
    const el = tierScrollRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const cw = el.clientWidth;
    setTierScrollLayout((prev) => (prev.scrollLeft === sl && prev.clientWidth === cw ? prev : { scrollLeft: sl, clientWidth: cw }));
  }, []);

  const setTierScrollPx = useCallback(
    (px: number) => {
      const tier = tierScrollRef.current;
      const w = wfApiRef.current;
      if (!tier || !w.isReady) return;
      scrollSyncingRef.current = true;
      try {
        const maxSl = Math.max(0, timelineWidthPx - tier.clientWidth);
        const sl = Math.max(0, Math.min(maxSl, px));
        tier.scrollLeft = sl;
        w.setScrollLeft(sl);
      } finally {
        scrollSyncingRef.current = false;
        refreshTierScrollLayout();
      }
    },
    [timelineWidthPx, refreshTierScrollLayout],
  );

  const seekFromTierClientX = useCallback((clientX: number) => {
    const w = wfApiRef.current;
    if (!w.isReady || (w.duration || 0) <= 0) return;
    const t = w.clientXToTimeSec(clientX);
    w.seek(t);
  }, []);

  const onPickAbsoluteTime = useCallback(
    (t: number, mode: "seek" | "seekAndCenterViewport") => {
      const w = wfApiRef.current;
      const d = w.duration || 0;
      if (d <= 0) return;
      const clamped = Math.max(0, Math.min(d, t));
      w.seek(clamped);
      if (mode === "seekAndCenterViewport") {
        const tier = tierScrollRef.current;
        if (!tier) return;
        const tw = Math.max(timelineWidthPx, 1);
        const vw = tier.clientWidth;
        const targetScroll = (clamped / d) * tw - vw / 2;
        setTierScrollPx(targetScroll);
      }
    },
    [timelineWidthPx, setTierScrollPx],
  );

  const onTierScroll = useCallback(() => {
    const tier = tierScrollRef.current;
    if (!tier) return;
    const sl = tier.scrollLeft;
    const w = wfApiRef.current;
    if (w.isReady && !scrollSyncingRef.current) {
      scrollSyncingRef.current = true;
      try {
        if (Math.abs(w.getScrollLeft() - sl) > 0.01) w.setScrollLeft(sl);
      } finally {
        scrollSyncingRef.current = false;
      }
    }
    if (tierScrollLayoutRafRef.current) cancelAnimationFrame(tierScrollLayoutRafRef.current);
    tierScrollLayoutRafRef.current = requestAnimationFrame(() => {
      tierScrollLayoutRafRef.current = 0;
      const cw = tier.clientWidth;
      setTierScrollLayout((prev) => (prev.scrollLeft === sl && prev.clientWidth === cw ? prev : { scrollLeft: sl, clientWidth: cw }));
    });
  }, []);

  useEffect(() => {
    refreshTierScrollLayout();
  }, [timelineWidthPx, wf.isReady, ctx.mediaUrl, refreshTierScrollLayout]);

  useEffect(() => {
    const el = tierScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => refreshTierScrollLayout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ctx.mediaUrl, refreshTierScrollLayout]);

  useEffect(
    () => () => {
      if (tierScrollLayoutRafRef.current) cancelAnimationFrame(tierScrollLayoutRafRef.current);
    },
    [],
  );

  useEffect(() => {
    const tier = tierScrollRef.current;
    if (tier) tier.scrollLeft = 0;
  }, [ctx.mediaUrl]);

  useEffect(() => {
    if (!ctx.mediaUrl || !wf.isReady) return;
    wf.setScrollLeft(0);
  }, [ctx.mediaUrl, wf.isReady, wf.setScrollLeft]);

  /** 缩放或总宽变化后：WaveSurfer 已 `zoom`，将 tier 与 WS 的 scrollLeft 钳到同一值，避免语段卡与 region 错位。 */
  useEffect(() => {
    const tier = tierScrollRef.current;
    const w = wfApiRef.current;
    if (!tier || !w.isReady || timelineWidthPx <= 0) return;
    const maxSl = Math.max(0, timelineWidthPx - tier.clientWidth);
    scrollSyncingRef.current = true;
    try {
      const wsSl = w.getScrollLeft();
      const sl = Math.min(maxSl, Math.max(0, wsSl));
      tier.scrollLeft = sl;
      if (Math.abs(w.getScrollLeft() - sl) > 0.5) w.setScrollLeft(sl);
    } finally {
      scrollSyncingRef.current = false;
      refreshTierScrollLayout();
    }
  }, [pxPerSec, timelineWidthPx, wf.isReady, refreshTierScrollLayout]);

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-p1-seg-row="${ctx.selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [ctx.selectedIdx]);

  useEffect(() => {
    const onWinKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("textarea, input, [contenteditable=true]")) return;
      e.preventDefault();
      if (e.shiftKey) ctx.redo();
      else ctx.undo();
    };
    window.addEventListener("keydown", onWinKey, true);
    return () => window.removeEventListener("keydown", onWinKey, true);
  }, [ctx.undo, ctx.redo]);

  const selectSegmentAt = useCallback(
    (idx: number) => {
      const c = ctxRef.current;
      const w = wfApiRef.current;
      const s = c.segments[idx];
      if (!s) return;
      w.seek(s.start_sec);
      setSelectedIdxUi(idx);
    },
    [setSelectedIdxUi],
  );

  const focusWaveformShell = useCallback(() => {
    waveformShellRef.current?.focus();
  }, []);

  const onWaveformMainKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const c = ctxRef.current;
      const w = wfApiRef.current;
      if (c.busy) return;
      const t = e.target as HTMLElement;
      if (t.closest("textarea, input, [contenteditable=true]")) return;

      const mod = e.metaKey || e.ctrlKey;

      const seekSeg = (idx: number) => {
        const s = c.segments[idx];
        if (!s) return;
        w.seek(s.start_sec);
        setSelectedIdxUi(idx);
      };

      if (e.key === "Escape") {
        e.preventDefault();
        (e.target as HTMLElement).blur();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        void w.togglePlay();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (c.segments.length > 0) c.deleteSegmentAt(c.selectedIdx);
        return;
      }
      if (mod && e.key.toLowerCase() === "m" && e.shiftKey) {
        e.preventDefault();
        c.mergeWithPrev();
        return;
      }
      if (mod && e.key.toLowerCase() === "m" && !e.shiftKey) {
        e.preventDefault();
        c.mergeWithNext();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        c.splitAtPlayhead(w.getPlayheadTime());
        return;
      }
      if (e.key === "ArrowLeft" && !mod) {
        e.preventDefault();
        if (c.selectedIdx > 0) seekSeg(c.selectedIdx - 1);
        return;
      }
      if (e.key === "ArrowRight" && !mod) {
        e.preventDefault();
        if (c.selectedIdx < c.segments.length - 1) seekSeg(c.selectedIdx + 1);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (!e.shiftKey) {
          if (c.selectedIdx < c.segments.length - 1) {
            const ni = c.selectedIdx + 1;
            seekSeg(ni);
            void w.playSegmentAtIndex(ni);
          }
        } else if (c.selectedIdx > 0) {
          const pi = c.selectedIdx - 1;
          seekSeg(pi);
          void w.playSegmentAtIndex(pi);
        }
        return;
      }
      if (e.key === "," && !mod) {
        e.preventDefault();
        w.seekByDelta(-1 / 30);
        return;
      }
      if (e.key === "." && !mod) {
        e.preventDefault();
        w.seekByDelta(1 / 30);
        return;
      }
      if (e.key === "[" && !mod) {
        e.preventDefault();
        const from = c.selectedIdx;
        let j = -1;
        for (let k = from - 1; k >= 0; k--) {
          if (c.segments[k]?.low_confidence) {
            j = k;
            break;
          }
        }
        if (j < 0) {
          for (let k = c.segments.length - 1; k >= 0; k--) {
            if (c.segments[k]?.low_confidence) {
              j = k;
              break;
            }
          }
        }
        if (j >= 0) seekSeg(j);
        return;
      }
      if (e.key === "]" && !mod) {
        e.preventDefault();
        const from = c.selectedIdx;
        let j = -1;
        for (let k = from + 1; k < c.segments.length; k++) {
          if (c.segments[k]?.low_confidence) {
            j = k;
            break;
          }
        }
        if (j < 0) {
          for (let k = 0; k < c.segments.length; k++) {
            if (c.segments[k]?.low_confidence) {
              j = k;
              break;
            }
          }
        }
        if (j >= 0) seekSeg(j);
      }
    },
    [setSelectedIdxUi],
  );

  const onSegmentTextareaKeyDown = useCallback(
    (segmentIdx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      const c = ctxRef.current;
      const w = wfApiRef.current;
      if (e.key !== "Tab") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (e.shiftKey) {
        if (segmentIdx <= 0) return;
        const pi = segmentIdx - 1;
        const s = c.segments[pi];
        if (!s) return;
        w.seek(s.start_sec);
        setSelectedIdxUi(pi);
        void w.playSegmentAtIndex(pi);
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(`[data-p1-seg-row="${pi}"] input.p1-seg-text`)?.focus();
        });
      } else {
        if (segmentIdx >= c.segments.length - 1) return;
        const ni = segmentIdx + 1;
        const s = c.segments[ni];
        if (!s) return;
        w.seek(s.start_sec);
        setSelectedIdxUi(ni);
        void w.playSegmentAtIndex(ni);
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(`[data-p1-seg-row="${ni}"] input.p1-seg-text`)?.focus();
        });
      }
    },
    [setSelectedIdxUi],
  );

  return {
    tierScrollLayout,
    seekFromTierClientX,
    setTierScrollPx,
    onPickAbsoluteTime,
    segmentLaneLayout,
    segmentLaneRowPx,
    waveformHeightPx,
    transcriptFontPx,
    nudgeWaveformHeight,
    nudgeTranscriptFontPx,
    beginWaveformHeightDrag,
    beginTranscriptFontDrag,
    tierScrollRef,
    waveformShellRef,
    onTierScroll,
    timelineWidthPx,
    pxPerSec,
    zoomIn,
    zoomOut,
    resetZoom,
    zoomToFitTier,
    zoomToFitSelection,
    setPxPerSec,
    selectSegmentAt,
    insertSegmentAfter: ctx.insertSegmentAfter,
    deleteSegmentAt: ctx.deleteSegmentAt,
    splitAtPlayhead: ctx.splitAtPlayhead,
    segmentToolbar,
    focusWaveformShell,
    onWaveformMainKeyDown,
    onSegmentTextareaKeyDown,
    ...wf,
  };
}
