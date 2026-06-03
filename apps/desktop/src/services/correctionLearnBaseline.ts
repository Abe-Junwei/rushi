import type { SegmentDto } from "../tauri/projectApi";

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
