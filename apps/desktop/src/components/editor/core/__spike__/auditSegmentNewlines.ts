import type { SegmentDto } from "../../../../tauri/projectTypes";

export type SegmentNewlineHit = {
  idx: number;
  uid: string | undefined;
  newlineCount: number;
  textLength: number;
};

export type SegmentNewlineAudit = {
  totalSegments: number;
  hits: SegmentNewlineHit[];
  hitRate: number;
};

/**
 * Audit segment texts for embedded `\n` / `\r`.
 * Does not mutate data — strategy decision belongs in research §7 after real audit.
 */
export function auditSegmentNewlines(segments: readonly SegmentDto[]): SegmentNewlineAudit {
  const hits: SegmentNewlineHit[] = [];
  for (let i = 0; i < segments.length; i++) {
    const text = segments[i]?.text ?? "";
    const newlineCount = (text.match(/\r\n|\n|\r/g) ?? []).length;
    if (newlineCount > 0) {
      hits.push({
        idx: i,
        uid: segments[i]?.uid,
        newlineCount,
        textLength: text.length,
      });
    }
  }
  return {
    totalSegments: segments.length,
    hits,
    hitRate: segments.length === 0 ? 0 : hits.length / segments.length,
  };
}

/**
 * Explicit reversible encoding for spike experiments only.
 * Uses SYMBOL FOR LINE FEED (U+240A) — not a silent space replace.
 */
export const SPIKE_NEWLINE_ESCAPE = "\u240A";

export function encodeNewlinesForSingleLineDoc(text: string): string {
  return text.replace(/\r\n|\n|\r/g, SPIKE_NEWLINE_ESCAPE);
}

export function decodeNewlinesFromSingleLineDoc(text: string): string {
  return text.split(SPIKE_NEWLINE_ESCAPE).join("\n");
}
