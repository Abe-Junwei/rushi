import type { SegmentDto } from "../tauri/projectApi";
import { joinMergedSegmentTexts } from "../utils/joinMergedSegmentTexts";

export type LearnBaselineText = { uid: string; text: string };

/** Snapshot texts used for correction memory baseline (before this save). */
export function segmentsToLearnBaseline(segments: SegmentDto[]): LearnBaselineText[] {
  const out: LearnBaselineText[] = [];
  for (const seg of segments) {
    const uid = seg.uid?.trim();
    if (!uid) continue;
    out.push({ uid, text: seg.text });
  }
  return out;
}

/** Align with `mergeTwoSegments` / `joinMergedSegmentTexts` (no embedded `\n`). */
function concatMergedBaselineTexts(a: string, b: string): string {
  return joinMergedSegmentTexts(a, b);
}

/**
 * Per-uid baseline for save-time learning when split/merge changed segment count.
 * Merge: concatenate absorbed snapshot neighbors (same rule as mergeTwoSegments).
 * Split: kept uid keeps full snapshot text; new uids get "" (infer skipped in Rust).
 */
export function segmentsToLearnBaselineAligned(
  savedSnapshot: SegmentDto[],
  currentSegments: SegmentDto[],
): LearnBaselineText[] {
  const savedByUid = new Map<string, string>();
  for (const seg of savedSnapshot) {
    const uid = seg.uid?.trim();
    if (uid) savedByUid.set(uid, seg.text);
  }

  const currentUids = new Set(
    currentSegments.map((s) => s.uid?.trim()).filter((u): u is string => Boolean(u)),
  );

  const out: LearnBaselineText[] = [];
  const emitted = new Set<string>();

  for (const seg of currentSegments) {
    const uid = seg.uid?.trim();
    if (!uid || emitted.has(uid)) continue;

    let text = savedByUid.get(uid) ?? "";
    const snapIdx = savedSnapshot.findIndex((s) => s.uid?.trim() === uid);
    if (snapIdx >= 0 && text) {
      let j = snapIdx + 1;
      while (j < savedSnapshot.length) {
        const absorbedUid = savedSnapshot[j]?.uid?.trim() ?? "";
        if (!absorbedUid || currentUids.has(absorbedUid)) break;
        text = concatMergedBaselineTexts(text, savedSnapshot[j].text);
        j += 1;
      }
    }

    out.push({ uid, text });
    emitted.add(uid);
  }
  return out;
}
