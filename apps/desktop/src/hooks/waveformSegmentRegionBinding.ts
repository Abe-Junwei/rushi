import type { MutableRefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions";
import { roundSec3 } from "../utils/boundsSignature";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

type RegionsPluginInstance = ReturnType<typeof RegionsPlugin.create>;

export type WaveformRegionBindingContext = {
  wsRef: MutableRefObject<WaveSurfer | null>;
  regionsRef: MutableRefObject<RegionsPluginInstance | null>;
  optsRef: MutableRefObject<UseProjectWaveformOptions>;
  isDraggingRef: MutableRefObject<boolean>;
  syncingRegionsRef: MutableRefObject<boolean>;
  skippedBoundsDuringDragRef: MutableRefObject<boolean>;
  rebuildAllSegmentRegionsRef: MutableRefObject<(ws: WaveSurfer, rp: RegionsPluginInstance) => void>;
  regionUnsubsRef: MutableRefObject<Array<() => void>>;
  resolveSegmentIndexByUid: (uid: string) => number;
};

export function bindWaveformSegmentRegion(
  ws: WaveSurfer,
  region: Region,
  uid: string,
  ctx: WaveformRegionBindingContext,
) {
  const {
    wsRef,
    regionsRef,
    optsRef,
    isDraggingRef,
    syncingRegionsRef,
    skippedBoundsDuringDragRef,
    rebuildAllSegmentRegionsRef,
    regionUnsubsRef,
    resolveSegmentIndexByUid,
  } = ctx;

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
}
