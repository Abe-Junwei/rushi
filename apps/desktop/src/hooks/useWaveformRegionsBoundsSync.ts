import { useEffect, type MutableRefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { waveformRegionFillColor } from "../utils/segmentChrome";
import { segmentUidOf } from "../utils/segmentUid";
import { parseSegmentRegionUid, segmentRegionId } from "../utils/waveformRegionId";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";
import { bindWaveformSegmentRegion, type WaveformRegionBindingContext } from "./waveformSegmentRegionBinding";

type RegionsPluginInstance = ReturnType<typeof RegionsPlugin.create>;

export function useWaveformRegionsBoundsSync(params: {
  wsRef: MutableRefObject<WaveSurfer | null>;
  regionsRef: MutableRefObject<RegionsPluginInstance | null>;
  optsRef: MutableRefObject<UseProjectWaveformOptions>;
  isReady: boolean;
  disabled: boolean | undefined;
  boundsSig: string;
  uidSig: string;
  isDraggingRef: MutableRefObject<boolean>;
  syncingRegionsRef: MutableRefObject<boolean>;
  skippedBoundsDuringDragRef: MutableRefObject<boolean>;
  rebuildAllSegmentRegionsRef: MutableRefObject<(ws: WaveSurfer, rp: RegionsPluginInstance) => void>;
  regionUnsubsRef: MutableRefObject<Array<() => void>>;
  resolveSegmentIndexByUid: (uid: string) => number;
}) {
  const {
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
  } = params;

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

    const bindCtx: WaveformRegionBindingContext = {
      wsRef,
      regionsRef,
      optsRef,
      isDraggingRef,
      syncingRegionsRef,
      skippedBoundsDuringDragRef,
      rebuildAllSegmentRegionsRef,
      regionUnsubsRef,
      resolveSegmentIndexByUid,
    };

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
        bindWaveformSegmentRegion(ws, region, uid, bindCtx);
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
  }, [
    boundsSig,
    uidSig,
    isReady,
    disabled,
    wsRef,
    regionsRef,
    optsRef,
    isDraggingRef,
    syncingRegionsRef,
    skippedBoundsDuringDragRef,
    rebuildAllSegmentRegionsRef,
    regionUnsubsRef,
    resolveSegmentIndexByUid,
  ]);
}
