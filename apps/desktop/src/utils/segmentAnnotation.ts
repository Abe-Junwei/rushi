import type { SegmentDto } from "../tauri/projectApi";

export function segmentHasAnnotation(seg: SegmentDto): boolean {
  return Boolean(seg.annotation?.trim());
}

export function segmentAnnotationMenuLabel(seg: SegmentDto): string {
  return segmentHasAnnotation(seg) ? "编辑备注…" : "添加备注…";
}

export function formatSegmentAnnotationPreview(text: string, maxLen = 80): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

export function normalizeSegmentAnnotationInput(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 合并语段时拼接两侧备注（Plan B5–B7）。 */
export function mergeSegmentAnnotations(a: SegmentDto, b: SegmentDto): string | null {
  const left = a.annotation?.trim() ?? "";
  const right = b.annotation?.trim() ?? "";
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  return `${left}\n\n---\n\n${right}`;
}
