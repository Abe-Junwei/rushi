import type { ProjectSummary } from "../tauri/projectApi";

export const WELCOME_PROJECT_ROW_ICON =
  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-notion-text-muted";
export const WELCOME_PROJECT_ACTION_BTN =
  "flex h-7 w-7 shrink-0 appearance-none items-center justify-center rounded-md border-0 bg-transparent p-0 text-notion-text-muted transition-[color,background-color,opacity] hover:bg-notion-sidebar-active hover:text-notion-text disabled:opacity-40";
export const WELCOME_PROJECT_DELETE_BTN = `${WELCOME_PROJECT_ACTION_BTN} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100`;

export function sortWelcomeProjects(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
}

export function formatRecentProjectDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) {
    return `${month}月${day}日更新`;
  }
  return `${d.getFullYear()}年${month}月${day}日更新`;
}

export function formatRecentProjectName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function projectFileCountLabel(count: number): string {
  if (count <= 0) return "暂无文件";
  return `${count} 个文件`;
}
