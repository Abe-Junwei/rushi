import type { ProjectDetail, ProjectSummary } from "../tauri/projectTypes";

/** Case-insensitive exact match on trimmed project names. */
export function findDuplicateProjectNames(
  projects: ProjectSummary[],
  name: string,
  excludeProjectId?: string,
): ProjectSummary[] {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return [];
  return projects.filter(
    (p) =>
      p.id !== excludeProjectId &&
      p.name.trim().toLowerCase() === normalized,
  );
}

export function suggestUniqueProjectName(projects: ProjectSummary[], baseName: string): string {
  const trimmed = baseName.trim() || "未命名项目";
  if (findDuplicateProjectNames(projects, trimmed).length === 0) return trimmed;
  let n = 2;
  let candidate = `${trimmed} (${n})`;
  while (projects.some((p) => p.name.trim().toLowerCase() === candidate.toLowerCase())) {
    n += 1;
    candidate = `${trimmed} (${n})`;
  }
  return candidate;
}

export function mergeProjectDetailMetadata(
  current: ProjectDetail,
  loaded: ProjectDetail,
): ProjectDetail {
  return {
    ...current,
    ...loaded,
    files: loaded.files,
    segments: current.segments,
    audio_storage_path: current.audio_storage_path,
  };
}
