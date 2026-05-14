import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

import { COLORS } from "../config/tokens";
import { roundSec3 } from "../utils/p1BoundsSignature";
import { p1WaveformRegionFillColor } from "../utils/p1SegmentChrome";
import { parseSegmentRegionId, segmentRegionId, REGION_ID_PREFIX } from "../utils/waveformRegionId";
import type { UseProjectWaveformOptions } from "./useProjectWaveform";

export function useWaveformRegions(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  regionsRef: React.MutableRefObject<ReturnType<typeof RegionsPlugin.create> | null>,
  optsRef: React.MutableRefObject<UseProjectWaveformOptions>,
  isReady: boolean,
  disabled: boolean | undefined,
  boundsSig: string,
  selectedIdx: number,
  onWaveformCreateRange: UseProjectWaveformOptions["onWaveformCreateRange"],
) {
  const isDraggingRef = useRef(false);
  const syncingRegionsRef = useRef(false);
  const prevSelectedIdxForColorRef = useRef<number | null>(null);
  const regionUnsubsRef = useRef<Array<() => void>>([]);
  const skippedBoundsDuringDragRef = useRef(false);
  const rebuildAllSegmentRegionsRef = useRef<(ws: WaveSurfer, rp: ReturnType<typeof RegionsPlugin.create>) => void>(
    () => {},
  );

  const clearRegionListeners = useCallback(() => {
    regionUnsubsRef.current.forEach((u) => u());
    regionUnsubsRef.current = [];
  }, []);

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
      const flushSkippedResyncAfterDrag = () => {
        if (!skippedBoundsDuringDragRef.current) return;
        const attempt = (n: number) => {
          if (n > 24) return;
          requestAnimationFrame(() => {
            if (syncingRegionsRef.current) {
              attempt(n + 1);
              return;
            }
            if (!skippedBoundsDuringDragRef.current) return;
            skippedBoundsDuringDragRef.current = false;
            const ws2 = wsRef.current;
            const rp2 = regionsRef.current;
            if (!ws2 || !rp2 || optsRef.current.disabled) return;
            rebuildAllSegmentRegionsRef.current(ws2, rp2);
          });
        };
        attempt(0);
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
        if (syncingRegionsRef.current) {
          flushSkippedResyncAfterDrag();
          return;
        }
        const lo = Math.min(region.start, region.end);
        const hi = Math.max(region.start, region.end);
        const dur = ws.getDuration() || hi;
        const clampedStart = roundSec3(Math.max(0, lo));
        const clampedEnd = roundSec3(Math.min(Math.max(clampedStart + 0.05, hi), dur));
        optsRef.current.onBoundsCommit(i, clampedStart, clampedEnd);
        flushSkippedResyncAfterDrag();
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
    [wsRef, regionsRef, optsRef],
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
    [bindSegmentRegion, clearRegionListeners, optsRef],
  );

  rebuildAllSegmentRegionsRef.current = rebuildAllSegmentRegions;

  /** 语段 regions：段数或 id 映射变化时全量重建；仅起止/低置信变化时增量 setOptions。 */
  useEffect(() => {
    const ws = wsRef.current;
    const rp = regionsRef.current;
    if (!ws || !rp || !isReady || disabled) return;
    if (isDraggingRef.current) {
      skippedBoundsDuringDragRef.current = true;
      return;
    }

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

    skippedBoundsDuringDragRef.current = false;

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
  }, [boundsSig, isReady, disabled, wsRef, regionsRef, optsRef, rebuildAllSegmentRegions]);

  /** 波形空白处拖选 → 新建语段（Regions enableDragSelection） */
  useEffect(() => {
    const ws = wsRef.current;
    const rp = regionsRef.current;
    if (!ws || !rp || !isReady || disabled) return;
    const onCreate = optsRef.current.onWaveformCreateRange;
    if (!onCreate) return;

    const disableDragSelection = rp.enableDragSelection({
      color: `color-mix(in srgb, ${COLORS.ink} 7%, transparent)`,
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
  }, [isReady, disabled, wsRef, regionsRef, optsRef, onWaveformCreateRange]);

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
  }, [selectedIdx, isReady, disabled, wsRef, regionsRef, optsRef]);

  return {
    clearRegionListeners,
    rebuildAllSegmentRegions,
  };
}
