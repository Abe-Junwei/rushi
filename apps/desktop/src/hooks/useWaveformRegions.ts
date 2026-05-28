import { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

import { COLORS } from "../config/tokens";
import { waveformRegionFillColor } from "../utils/segmentChrome";
import { segmentUidOf } from "../utils/segmentUid";
import { segmentRegionId, REGION_ID_PREFIX } from "../utils/waveformRegionId";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";
import { useWaveformRegionsBoundsSync } from "./useWaveformRegionsBoundsSync";
import { bindWaveformSegmentRegion } from "./waveformSegmentRegionBinding";

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
  const rebuildAllSegmentRegionsRef = useRef<
    (ws: WaveSurfer, rp: ReturnType<typeof RegionsPlugin.create>) => void
  >(() => {});

  const clearRegionListeners = useCallback(() => {
    regionUnsubsRef.current.forEach((u) => u());
    regionUnsubsRef.current = [];
  }, []);

  const resolveSegmentIndexByUid = useCallback(
    (uid: string): number => optsRef.current.segments.findIndex((s) => segmentUidOf(s) === uid),
    [optsRef],
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
        bindWaveformSegmentRegion(ws, region, uid, {
          wsRef,
          regionsRef,
          optsRef,
          isDraggingRef,
          syncingRegionsRef,
          skippedBoundsDuringDragRef,
          rebuildAllSegmentRegionsRef,
          regionUnsubsRef,
          resolveSegmentIndexByUid,
        });
      });
    },
    [clearRegionListeners, optsRef, resolveSegmentIndexByUid],
  );

  rebuildAllSegmentRegionsRef.current = rebuildAllSegmentRegions;

  useWaveformRegionsBoundsSync({
    wsRef,
    regionsRef,
    optsRef,
    isReady,
    disabled,
    boundsSig,
    uidSig,
    isDraggingRef,
    syncingRegionsRef,
    skippedBoundsDuringDragRef,
    rebuildAllSegmentRegionsRef,
    regionUnsubsRef,
    resolveSegmentIndexByUid,
  });

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
  }, [selectedIdx, isReady, disabled, regionsRef, optsRef]);

  return {
    clearRegionListeners,
    rebuildAllSegmentRegions,
  };
}
