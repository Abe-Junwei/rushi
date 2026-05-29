/**
 * Tile lifecycle for content-tile peaks renderer (ADR-0004, P1).
 *
 * Responsibilities:
 * - Maintain an LRU pool of "active" tile indexes (visible + overscan + recently
 *   visited), capped at `cap` (default 16). Visible/overscan tiles are never
 *   evicted; LRU only governs the slack between visible and cap.
 * - Bump a global `generation` counter whenever `contentKey` changes
 *   (e.g. `pxPerSec` or `peakCache` identity). Every active tile reports the
 *   current generation, so consumers (`<WaveformPeaksTile>`) can compare it
 *   against the last value they drew and decide whether to repaint.
 * - Output `activeTiles` sorted by index, each carrying its layout slot
 *   (`leftPx`, `widthPx`) and the current generation.
 *
 * This hook is pure with respect to its inputs (modulo a counter ref for
 * deterministic LRU ordering and a generation ref). No timers, no rAF — the
 * caller decides when/how to schedule the actual `draw` calls.
 */

import { useMemo, useRef } from "react";
import type { TileLayout, TileSlot } from "../services/waveform/tileGeometry";

export type TileLifecycleEntry = TileSlot & {
  /** Bumped every time `contentKey` changes; tiles compare against last-drawn gen. */
  generation: number;
};

export type UseWaveformTileLifecycleArgs = {
  layout: TileLayout;
  /**
   * Combined invalidation key: any change here means every active tile is
   * out-of-date and must be repainted. Typical: `${pxPerSec}|${peakCacheGen}`.
   */
  contentKey: string | number;
  /**
   * Viewport / tile grid geometry (not scroll position). Bumps generation when the
   * tier grows (maximize/fullscreen) so newly exposed tiles repaint.
   */
  layoutGeometryKey?: string | number;
  /**
   * Soft cap on total active tile DOM nodes (visible + LRU cache).
   * Visible/overscan tiles always retained; LRU only governs the slack.
   * Default 16 — see ADR-0004.
   */
  cap?: number;
};

export type UseWaveformTileLifecycleReturn = {
  activeTiles: TileLifecycleEntry[];
};

const DEFAULT_CAP = 16;

export function useWaveformTileLifecycle(
  args: UseWaveformTileLifecycleArgs,
): UseWaveformTileLifecycleReturn {
  const { layout, contentKey, layoutGeometryKey = "", cap = DEFAULT_CAP } = args;
  const { startIndex, endIndex } = layout.visibleRange;
  const { totalTiles, tileWidthPx } = layout;
  const invalidationKey = `${contentKey}|${layoutGeometryKey}`;

  // LRU: index -> monotonic visit time. Map iteration order is insertion-time;
  // we re-insert on visit to keep "most recent at end" without a separate sort.
  const lruRef = useRef<Map<number, number>>(new Map());
  const visitCounterRef = useRef(0);
  const generationRef = useRef(0);
  const lastInvalidationKeyRef = useRef<string | null>(null);

  // Deps are primitives only — layout identity changes every frame (scrollLeft
  // updates) but the actual visible range / geometry numbers stay constant when
  // scroll doesn't cross a tile boundary. Skipping useMemo recompute on those
  // frames means React's children get stable tile object refs → no reconciler
  // work → no jitter when reversing scroll direction.
  return useMemo(() => {
    // 1. Invalidate-all on content/zoom/viewport geometry change.
    if (lastInvalidationKeyRef.current !== invalidationKey) {
      generationRef.current += 1;
      lastInvalidationKeyRef.current = invalidationKey;
    }

    // 2. Mark visible (incl. overscan) range as freshly visited.
    const hasVisible = totalTiles > 0 && endIndex >= startIndex;
    const visibleSet = new Set<number>();
    if (hasVisible) {
      for (let i = startIndex; i <= endIndex; i++) {
        visibleSet.add(i);
        visitCounterRef.current += 1;
        // Re-insert to push to end of Map iteration order (LRU "most recent").
        lruRef.current.delete(i);
        lruRef.current.set(i, visitCounterRef.current);
      }
    }

    // 3. Evict oldest non-visible tiles until size ≤ cap.
    if (lruRef.current.size > cap) {
      // Map iteration order = insertion order; first entries are oldest visits.
      // Build a single eviction list before mutating to avoid iterator invalidation.
      const evictable: number[] = [];
      for (const [idx] of lruRef.current) {
        if (!visibleSet.has(idx)) evictable.push(idx);
      }
      let toEvict = lruRef.current.size - cap;
      for (const idx of evictable) {
        if (toEvict <= 0) break;
        lruRef.current.delete(idx);
        toEvict -= 1;
      }
      // Defensive: if visible+overscan alone exceeds cap (extremely wide viewport),
      // evict only non-visible tiles; never drop tiles in the current visible range.
      if (lruRef.current.size > cap && hasVisible) {
        const nonVisible = [...lruRef.current.keys()].filter((idx) => !visibleSet.has(idx));
        let toEvict = lruRef.current.size - cap;
        for (const idx of nonVisible) {
          if (toEvict <= 0) break;
          lruRef.current.delete(idx);
          toEvict -= 1;
        }
      }
    }

    // 4. Build sorted output. Filter out any tile that no longer maps to a
    //    valid layout slot (defensive — totalTiles can shrink on zoom-out).
    const indexes = [...lruRef.current.keys()]
      .filter((idx) => idx >= 0 && idx < totalTiles)
      .sort((a, b) => a - b);

    // Prune stale indexes from LRU map too, so memory doesn't leak across
    // dramatic timeline-width shrinks.
    if (indexes.length !== lruRef.current.size) {
      const keep = new Set(indexes);
      for (const idx of [...lruRef.current.keys()]) {
        if (!keep.has(idx)) lruRef.current.delete(idx);
      }
    }

    const activeTiles: TileLifecycleEntry[] = indexes.map((idx) => {
      const slot = layout.tileOf(idx);
      return {
        index: slot.index,
        leftPx: slot.leftPx,
        widthPx: slot.widthPx,
        generation: generationRef.current,
      };
    });

    return { activeTiles };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIndex, endIndex, totalTiles, tileWidthPx, invalidationKey, cap]);
}
