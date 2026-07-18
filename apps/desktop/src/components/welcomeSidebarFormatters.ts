import type { ProjectSummary } from "../tauri/projectApi";
import { CONTROL_BTN_ICON_GHOST } from "../config/controlStyles";

/** 侧栏项目行：图标槽（与 px-5 + gap-2 配合，文件行 pl-14 与标题左缘对齐） */
export const WELCOME_PROJECT_ROW_ICON =
  "flex h-7 w-7 shrink-0 items-center justify-center text-notion-text-muted";
export const WELCOME_SIDEBAR_PROJECT_NAME =
  "block truncate text-sm font-semibold leading-5 text-notion-text";
export const WELCOME_SIDEBAR_PROJECT_META =
  "mt-0.5 block truncate text-label leading-4 text-notion-text-muted";
/** 侧栏嵌套文件行左内边距：与项目行 px-5 + icon(28px) + gap-2(8px) 对齐 */
export const WELCOME_SIDEBAR_FILE_INDENT = "pl-14 pr-5";
/** 侧栏项目区水平内边距（与导航 px-5 对齐） */
export const WELCOME_SIDEBAR_SECTION_INSET_X = "px-5";
export const WELCOME_PROJECT_ACTION_BTN = `${CONTROL_BTN_ICON_GHOST} hover:bg-notion-sidebar-active`;

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
