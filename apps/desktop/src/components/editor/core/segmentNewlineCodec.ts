/**
 * Reversible newline codec for one-line-per-segment CM6 docs.
 * SYMBOL FOR LINE FEED (U+240A) — never silent space replace.
 */
export const TRANSCRIPT_NEWLINE_ESCAPE = "\u240A";

export function encodeSegmentTextForDocLine(text: string): string {
  return text.replace(/\r\n|\n|\r/g, TRANSCRIPT_NEWLINE_ESCAPE);
}

export function decodeDocLineToSegmentText(text: string): string {
  return text.split(TRANSCRIPT_NEWLINE_ESCAPE).join("\n");
}

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

export function auditSegmentNewlines(
  segments: readonly { uid?: string; text?: string }[],
): SegmentNewlineAudit {
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
