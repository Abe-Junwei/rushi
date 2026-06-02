import type { CorrectionExplicitPair } from "../tauri/fileApi";
import { shouldLearnInferredReplacement } from "./correctionInferPair";
import { graphemeCount } from "./text/grapheme";
import {
  collectLearnablePairsForSession,
  learnEditStateMatchesLive,
  type LearnEditState,
} from "./learnEditDelta";
import { listRevisionChanges, type RevisionChangeItem } from "./revisionDiff";

export type SkippedRevisionItem = {
  removed: string;
  inserted: string;
  reason: "single_char" | "delete_only" | "insert_only" | "tracking_lost" | "ops_filtered" | "other";
};

function coalesceRevisionChangeItems(items: RevisionChangeItem[]): RevisionChangeItem[] {
  const out: RevisionChangeItem[] = [];
  let i = 0;
  while (i < items.length) {
    const cur = items[i]!;
    const next = items[i + 1];
    if (next) {
      const curOnlyDel = cur.removed.length > 0 && cur.inserted.length === 0;
      const curOnlyIns = cur.removed.length === 0 && cur.inserted.length > 0;
      const nextOnlyDel = next.removed.length > 0 && next.inserted.length === 0;
      const nextOnlyIns = next.removed.length === 0 && next.inserted.length > 0;
      if ((curOnlyDel && nextOnlyIns) || (curOnlyIns && nextOnlyDel)) {
        out.push({
          removed: cur.removed || next.removed,
          inserted: cur.inserted || next.inserted,
        });
        i += 2;
        continue;
      }
    }
    out.push(cur);
    i += 1;
  }
  return out;
}

function skipReason(removed: string, inserted: string): SkippedRevisionItem["reason"] {
  const before = removed.trim();
  const after = inserted.trim();
  if (before && !after) return "delete_only";
  if (!before && after) return "insert_only";
  if (
    before &&
    after &&
    graphemeCount(before) === 1 &&
    graphemeCount(after) === 1 &&
    !shouldLearnInferredReplacement(before, after)
  ) {
    return "single_char";
  }
  return "other";
}

function skippedFromDiffPreview(baseline: string, live: string): SkippedRevisionItem[] {
  const skipped: SkippedRevisionItem[] = [];
  for (const ch of coalesceRevisionChangeItems(listRevisionChanges(baseline, live))) {
    if (!ch.removed && !ch.inserted) continue;
    skipped.push({
      removed: ch.removed,
      inserted: ch.inserted,
      reason: skipReason(ch.removed, ch.inserted),
    });
  }
  return skipped;
}

/** 实时记忆条：仅 beforeinput 追踪产生 learnable；无追踪时只列 skipped 预览。 */
export function partitionPendingLearnChanges(
  baseline: string,
  live: string,
  learnState?: LearnEditState,
): { learnablePairs: CorrectionExplicitPair[]; skipped: SkippedRevisionItem[] } {
  const learnablePairs = collectLearnablePairsForSession(learnState, baseline, live);
  if (learnablePairs.length > 0) {
    return { learnablePairs, skipped: [] };
  }

  const hadTracking =
    learnState &&
    learnState.ops.length > 0 &&
    learnState.ops.some((op) => op.removed.length > 0 || op.inserted.length > 0);

  if (hadTracking && learnEditStateMatchesLive(learnState, baseline, live)) {
    return {
      learnablePairs: [],
      skipped: [
        {
          removed: learnState.ops.map((op) => op.removed).join(""),
          inserted: learnState.ops.map((op) => op.inserted).join(""),
          reason: "ops_filtered",
        },
      ],
    };
  }

  if (hadTracking && !learnEditStateMatchesLive(learnState, baseline, live)) {
    return {
      learnablePairs: [],
      skipped: [
        {
          removed: learnState.ops.map((op) => op.removed).join(""),
          inserted: learnState.ops.map((op) => op.inserted).join(""),
          reason: "tracking_lost",
        },
        ...skippedFromDiffPreview(baseline, live),
      ],
    };
  }

  return { learnablePairs: [], skipped: skippedFromDiffPreview(baseline, live) };
}
