import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";

import { COLORS } from "../config/tokens";
import { roundSec3 } from "../utils/boundsSignature";
import { waveformRegionFillColor } from "../utils/segmentChrome";
import { segmentUidOf } from "../utils/segmentUid";
import { parseSegmentRegionUid, segmentRegionId, REGION_ID_PREFIX } from "../utils/waveformRegionId";
import type { UseProjectWaveformOptions } from "./useProjectWaveform";

export function useWaveformRegions(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  regionsRef: React.MutableRefObject<ReturnType<typeof RegionsPlugin.create> | null>,
  optsRef: React.MutableRefObject<UseProjectWaveformOptions>,
  isReady: boolean,
  disabled: boolean | undefined,
  boundsSig: string,
  uidSig: string,
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

  const resolveSegmentIndexByUid = useCallback(
    (uid: string): number => optsRef.current.segments.findIndex((s) => segmentUidOf(s) === uid),
    [optsRef],
  );

  const bindSegmentRegion = useCallback(
    (ws: WaveSurfer, region: Region, uid: string) => {
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
      };
      const onUpdateEnd = () => {
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
        const idx = resolveSegmentIndexByUid(uid);
        if (idx < 0) return;
        optsRef.current.onBoundsCommit(idx, clampedStart, clampedEnd);
        flushSkippedResyncAfterDrag();
      };
      const onClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        const idx = resolveSegmentIndexByUid(uid);
        if (idx < 0) return;
        optsRef.current.onSelectIndex(idx);
        ws.setTime(region.start);
      };
      const onDbl = (ev: MouseEvent) => {
        ev.stopPropagation();
        const idx = resolveSegmentIndexByUid(uid);
        if (idx < 0) return;
        optsRef.current.onSelectIndex(idx);
        void region.play(true);
      };

      region.on("update", onUpdate);
      region.on("update-end", onUpdateEnd);
      region.on("click", onClick);
      region.on("dblclick", onDbl);

      regionUnsubsRef.current.push(() => {
        region.un("update", onUpdate);
        region.un("update-end", onUpdateEnd);
        region.un("click", onClick);
        region.un("dblclick", onDbl);
      });
    },
    [resolveSegmentIndexByUid, wsRef, regionsRef, optsRef],
  );

  const rebuildAllSegmentRegions = useCallback(
    (ws: WaveSurfer, rp: ReturnType<typeof RegionsPlugin.create>) => {
      clearRegionListeners();
      rp.clearRegions();
      const segs = optsRef.current.segments;
      segs.forEach((seg, i) => {
        const uid = segmentUidOf(seg);
        if (!uid) return;
        const id = segmentRegionId(uid);
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
          color: waveformRegionFillColor(seg, primary),
        });
        bindSegmentRegion(ws, region, uid);
      });
    },
    [bindSegmentRegion, clearRegionListeners, optsRef],
  );

  rebuildAllSegmentRegionsRef.current = rebuildAllSegmentRegions;

  /** 按稳定 uid diff regions：增删单条，起止/颜色变更时 setOptions。 */
  useEffect(() => {
    const ws = wsRef.current;
    const rp = regionsRef.current;
    if (!ws || !rp || !isReady || disabled) return;
    if (isDraggingRef.current) {
      skippedBoundsDuringDragRef.current = true;
      return;
    }

    const segs = optsRef.current.segments;
    const expectedRegionIds = new Set<string>();
    for (const seg of segs) {
      const uid = segmentUidOf(seg);
      if (uid) expectedRegionIds.add(segmentRegionId(uid));
    }

    syncingRegionsRef.current = true;
    const rafIds = { a: 0, b: 0 };

    for (const region of rp.getRegions()) {
      const parsedUid = parseSegmentRegionUid(region.id);
      if (parsedUid == null) continue;
      if (!expectedRegionIds.has(region.id)) {
        try {
          region.remove();
        } catch {
          /* noop */
        }
      }
    }

    const liveById = new Map(rp.getRegions().map((r) => [r.id, r]));
    const sel = optsRef.current.selectedIdx;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const uid = segmentUidOf(seg);
      if (!uid) continue;
      const id = segmentRegionId(uid);
      const start = Math.max(0, seg.start_sec);
      const end = Math.max(start + 0.04, seg.end_sec);
      const existing = liveById.get(id);
      if (!existing) {
        const region = rp.addRegion({
          id,
          start,
          end,
          drag: true,
          resize: true,
          minLength: 0.05,
          color: waveformRegionFillColor(seg, i === sel),
        });
        bindSegmentRegion(ws, region, uid);
        continue;
      }
      existing.setOptions({
        start,
        end,
        color: waveformRegionFillColor(seg, i === sel),
      });
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
  }, [boundsSig, uidSig, isReady, disabled, wsRef, regionsRef, optsRef, bindSegmentRegion]);

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

  /** 仅选中变化：只改旧/新两条 region 颜色。 */
  useEffect(() => {
    const rp = regionsRef.current;
    if (!rp || !isReady || disabled) return;
    const liveSegs = optsRef.current.segments;
    const prev = prevSelectedIdxForColorRef.current;
    prevSelectedIdxForColorRef.current = selectedIdx;

    const paint = (idx: number | null) => {
      if (idx == null || idx < 0 || idx >= liveSegs.length) return;
      const seg = liveSegs[idx];
      if (!seg) return;
      const uid = segmentUidOf(seg);
      if (!uid) return;
      const id = segmentRegionId(uid);
      const r = rp.getRegions().find((x) => x.id === id);
      if (!r) return;
      r.setOptions({ color: waveformRegionFillColor(seg, idx === selectedIdx) });
    };

    if (prev !== null && prev !== selectedIdx) paint(prev);
    paint(selectedIdx);
  }, [selectedIdx, isReady, disabled, wsRef, regionsRef, optsRef]);

  return {
    clearRegionListeners,
    rebuildAllSegmentRegions,
  };
}
