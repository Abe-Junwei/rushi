/** Welcome「最近 / 所有文件」FileSummary 缓存 — invalidator 由 WelcomeView 注册。 */

type ProjectFilesInvalidator = (projectIds: string[]) => void;
type RecentFilesRefresh = () => void;

let projectFilesInvalidator: ProjectFilesInvalidator | null = null;
let recentFilesRefresh: RecentFilesRefresh | null = null;

export function registerProjectFilesCacheInvalidator(fn: ProjectFilesInvalidator | null): void {
  projectFilesInvalidator = fn;
}

export function registerRecentWorkspaceFilesRefresh(fn: RecentFilesRefresh | null): void {
  recentFilesRefresh = fn;
}

/** Refresh「最近」ledger FileSummary / stage meters (Welcome may be unmounted). */
export function refreshRecentWorkspaceFiles(): void {
  try {
    recentFilesRefresh?.();
  } catch {
    // Welcome may be unmounted.
  }
}

/** Drop nested project file lists and refresh「最近」stage meters. */
export function invalidateProjectFilesCaches(projectIds: string[]): void {
  try {
    projectFilesInvalidator?.(projectIds);
  } catch {
    // Sidebar / Welcome may be unmounted.
  }
  refreshRecentWorkspaceFiles();
}
