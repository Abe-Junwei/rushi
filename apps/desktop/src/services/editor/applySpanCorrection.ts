import type { CorrectableSpan } from "./findCorrectableSpans";

export function applySpanCorrection(text: string, span: CorrectableSpan, replacement: string): string {
  const start = Math.max(0, Math.min(span.charStart, text.length));
  const end = Math.max(start, Math.min(span.charEnd, text.length));
  return text.slice(0, start) + replacement + text.slice(end);
}
