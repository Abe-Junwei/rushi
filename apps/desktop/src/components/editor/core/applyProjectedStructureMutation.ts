import type { SegmentDto } from "../../../tauri/projectTypes";
import { reindexSegments } from "../../../pages/segmentListHelpers";

/**
 * Merge CM6 structure projection into the live SegmentDto[] baseline by uid.
 * Preserves kind/confidence/annotation/detail for existing uids; new uids
 * (split/insert) keep projected fields.
 */
export function mergeProjectedStructureWithBaseline(
  baseline: readonly SegmentDto[],
  projected: readonly SegmentDto[],
): SegmentDto[] {
  const byUid = new Map<string, SegmentDto>();
  for (const s of baseline) {
    if (s.uid) byUid.set(s.uid, s);
  }
  const merged = projected.map((p, i) => {
    const prev = p.uid ? byUid.get(p.uid) : undefined;
    if (!prev) {
      return { ...p, idx: i };
    }
    return {
      ...prev,
      idx: i,
      start_sec: p.start_sec,
      end_sec: p.end_sec,
      text: p.text,
      text_stage: p.text_stage ?? prev.text_stage,
      finalize_via: p.finalize_via ?? prev.finalize_via,
    };
  });
  return reindexSegments(merged);
}

export type ApplyProjectedStructureMutationHandlers = {
  getBaseline: () => readonly SegmentDto[];
  pushUndo: () => void;
  publishStructure: (next: SegmentDto[]) => void;
  onPrimaryIdx?: (idx: number) => void;
};

/** Persist a CM6 structure projection through the legacy publish/undo chain. */
export function applyProjectedStructureMutation(
  projected: readonly SegmentDto[],
  primaryIdx: number,
  handlers: ApplyProjectedStructureMutationHandlers,
): SegmentDto[] {
  const next = mergeProjectedStructureWithBaseline(handlers.getBaseline(), projected);
  handlers.pushUndo();
  handlers.publishStructure(next);
  if (primaryIdx >= 0 && primaryIdx < next.length) {
    handlers.onPrimaryIdx?.(primaryIdx);
  }
  return next;
}
