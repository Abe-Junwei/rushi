import * as fileApi from "../tauri/fileApi";
import type { ProjectSummary } from "../tauri/projectApi";

export const LAST_WORKSPACE_STORAGE_KEY = "rushi:last-workspace:v1";

export type WorkspaceFileTarget = {
  projectId: string;
  fileId: string;
};

export type RecentWorkspaceFile = WorkspaceFileTarget & {
  name: string;
  fileType: string;
  updatedAtMs: number;
};

const RECENT_PROJECT_SCAN_LIMIT = 20;

export function readLastWorkspace(): WorkspaceFileTarget | null {
  try {
    const raw = window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { projectId?: string; fileId?: string };
    if (
      typeof parsed.projectId === "string" &&
      parsed.projectId.length > 0 &&
      typeof parsed.fileId === "string" &&
      parsed.fileId.length > 0
    ) {
      return { projectId: parsed.projectId, fileId: parsed.fileId };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

export function writeLastWorkspace(target: WorkspaceFileTarget): void {
  try {
    window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, JSON.stringify(target));
  } catch {
    /* quota / private mode */
  }
}

export function recentProjectIdsForScan(projects: ProjectSummary[]): string[] {
  return [...projects]
    .sort((a, b) => b.updated_at_ms - a.updated_at_ms)
    .slice(0, RECENT_PROJECT_SCAN_LIMIT)
    .map((p) => p.id);
}

export async function listRecentWorkspaceFiles(
  projectIds: string[],
  limit = 8,
): Promise<RecentWorkspaceFile[]> {
  if (projectIds.length === 0) return [];
  const groups = await Promise.all(
    projectIds.map(async (projectId) => {
      const files = await fileApi.listFiles(projectId);
      return files.map((f) => ({
        projectId,
        fileId: f.id,
        name: f.name,
        fileType: f.file_type,
        updatedAtMs: f.updated_at_ms,
      }));
    }),
  );
  return groups
    .flat()
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, limit);
}

export async function findMostRecentWorkspaceFile(
  projectIds: string[],
): Promise<WorkspaceFileTarget | null> {
  const recent = await listRecentWorkspaceFiles(projectIds, 1);
  if (recent.length === 0) return null;
  return { projectId: recent[0].projectId, fileId: recent[0].fileId };
}

/** Prefer last opened file; fall back to globally most recently updated file. */
export async function resolveEditorResumeTarget(
  projects: ProjectSummary[],
): Promise<WorkspaceFileTarget | null> {
  if (projects.length === 0) return null;

  const stored = readLastWorkspace();
  if (stored && projects.some((p) => p.id === stored.projectId)) {
    const files = await fileApi.listFiles(stored.projectId);
    if (files.some((f) => f.id === stored.fileId)) {
      return stored;
    }
  }

  return findMostRecentWorkspaceFile(recentProjectIdsForScan(projects));
}
