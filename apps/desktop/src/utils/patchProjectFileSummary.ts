import type { FileSummary, ProjectDetail } from "../tauri/projectTypes";

/** Patch one file row on the in-memory project (Hub list) without a full reload. */
export function patchProjectFileSummary(
  prev: ProjectDetail | null,
  fileId: string,
  patch: Partial<Pick<FileSummary, "duration_sec" | "segment_count" | "finalized_count" | "media_missing">>,
): ProjectDetail | null {
  if (!prev) return prev;
  let changed = false;
  const files = prev.files.map((f) => {
    if (f.id !== fileId) return f;
    const next = { ...f, ...patch };
    if (
      next.duration_sec === f.duration_sec &&
      next.segment_count === f.segment_count &&
      next.finalized_count === f.finalized_count &&
      next.media_missing === f.media_missing
    ) {
      return f;
    }
    changed = true;
    return next;
  });
  return changed ? { ...prev, files } : prev;
}

export function patchProjectFilesList(
  prev: ProjectDetail | null,
  files: FileSummary[],
): ProjectDetail | null {
  if (!prev) return prev;
  return { ...prev, files };
}
