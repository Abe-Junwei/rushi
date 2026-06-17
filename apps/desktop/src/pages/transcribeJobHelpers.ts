import type { SegmentDto } from "../tauri/projectApi";

/** Q1：是否存在非空语段正文，转写前需确认覆盖。 */
export function segmentsHaveNonEmptyText(segments: readonly SegmentDto[]): boolean {
  return segments.some((s) => String(s.text ?? "").trim().length > 0);
}

export type LocalTranscribePreflight = () => string | null;
