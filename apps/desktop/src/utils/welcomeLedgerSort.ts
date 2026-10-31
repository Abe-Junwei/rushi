import type { RecentWorkspaceFile } from "../services/lastWorkspace";
import type { FileSummary, ProjectSummary } from "../tauri/projectApi";
import { compareZhPinyin } from "./zhPinyinCompare";

export type WelcomeLedgerSortMode = "updated" | "name";

export const WELCOME_LEDGER_SORT_OPTIONS: ReadonlyArray<{
  value: WelcomeLedgerSortMode;
  label: string;
}> = [
  { value: "updated", label: "更新时间" },
  { value: "name", label: "名称" },
];

export function sortWelcomeProjectsByMode(
  list: readonly ProjectSummary[],
  mode: WelcomeLedgerSortMode,
): ProjectSummary[] {
  const copy = [...list];
  if (mode === "name") {
    return copy.sort(
      (a, b) => compareZhPinyin(a.name, b.name) || a.id.localeCompare(b.id),
    );
  }
  return copy.sort(
    (a, b) =>
      b.updated_at_ms - a.updated_at_ms || compareZhPinyin(a.name, b.name),
  );
}

export function sortRecentFilesByMode(
  files: readonly RecentWorkspaceFile[],
  mode: WelcomeLedgerSortMode,
): RecentWorkspaceFile[] {
  const copy = [...files];
  if (mode === "name") {
    return copy.sort(
      (a, b) => compareZhPinyin(a.name, b.name) || a.fileId.localeCompare(b.fileId),
    );
  }
  return copy.sort(
    (a, b) =>
      b.updatedAtMs - a.updatedAtMs || compareZhPinyin(a.name, b.name),
  );
}

export function sortProjectFilesByMode(
  files: readonly FileSummary[],
  mode: WelcomeLedgerSortMode,
): FileSummary[] {
  const copy = [...files];
  if (mode === "name") {
    return copy.sort(
      (a, b) => compareZhPinyin(a.name, b.name) || a.id.localeCompare(b.id),
    );
  }
  return copy.sort(
    (a, b) =>
      b.updated_at_ms - a.updated_at_ms || compareZhPinyin(a.name, b.name),
  );
}

/** 改名后选中下一项；已是末项则选上一项；仅一项则返回 null。 */
export function nextListId(ids: readonly string[], currentId: string): string | null {
  const i = ids.indexOf(currentId);
  if (i < 0) return null;
  if (i + 1 < ids.length) return ids[i + 1] ?? null;
  if (i > 0) return ids[i - 1] ?? null;
  return null;
}
