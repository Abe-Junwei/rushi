import { useCallback, useRef } from "react";
import type { SegmentPublishApi } from "./segmentPublishApi";
import { isSegmentFrozen } from "../utils/frozenPlaybackSkip";
import { dispatchTranscriptSyncMetaFromSegments } from "../components/editor/core/transcriptEditorViewHandle";
import { waitForSaveIdle } from "../services/waitForSaveIdle";

type Args = {
  busy: boolean;
  segmentPublish: SegmentPublishApi;
  saveSegments: (options?: { quiet?: boolean; countHits?: boolean }) => Promise<boolean>;
  pushUndo: () => void;
  setError: (msg: string) => void;
  /** Optional: indices to toggle; defaults to snapshot primary via selectedIdx. */
  getTargetIndices?: () => number[];
  /** Optional: shared autosave in-flight flag, to avoid colliding with autosave. */
  saveInFlightRef?: { current: boolean };
};

/**
 * Toggle `frozen` on one or more segments and persist quietly.
 * If any target is unfrozen → freeze all targets; if all frozen → unfreeze all.
 */
export function useSegmentFreezeController({
  busy,
  segmentPublish,
  saveSegments,
  pushUndo,
  setError,
  getTargetIndices,
  saveInFlightRef,
}: Args) {
  const persistInFlightRef = useRef(false);

  const toggleSegmentFrozen = useCallback(
    async (segmentIdx?: number) => {
      if (busy || persistInFlightRef.current) return false;
      const snap = segmentPublish.getCurrentSegmentsSnapshot();
      const indices =
        typeof segmentIdx === "number"
          ? [segmentIdx]
          : (getTargetIndices?.() ?? []).filter((i) => i >= 0 && i < snap.length);
      const targets = indices.length > 0 ? indices : [];
      if (targets.length === 0) return false;
      const anyUnfrozen = targets.some((i) => !isSegmentFrozen(snap[i]));
      const nextFrozen = anyUnfrozen;
      persistInFlightRef.current = true;
      try {
        pushUndo();
        const next = snap.map((row, i) =>
          targets.includes(i) ? { ...row, frozen: nextFrozen } : row,
        );
        segmentPublish.publishStructure(next);
        // Line count is unchanged by a freeze toggle, so sync CM meta immediately
        // to apply the edit guard + hatch without waiting for the React effect.
        dispatchTranscriptSyncMetaFromSegments(next);
        // Avoid colliding with an in-flight autosave (saveSegments no-ops while busy).
        if (saveInFlightRef?.current) {
          await waitForSaveIdle(saveInFlightRef);
        }
        const saved = await saveSegments({ quiet: true, countHits: false });
        if (!saved) {
          segmentPublish.publishStructure(snap);
          dispatchTranscriptSyncMetaFromSegments(snap);
          setError("冻结状态保存失败，请重试");
          return false;
        }
        return true;
      } finally {
        persistInFlightRef.current = false;
      }
    },
    [busy, getTargetIndices, pushUndo, saveInFlightRef, saveSegments, segmentPublish, setError],
  );

  return { toggleSegmentFrozen };
}
