import type { ContextMenuItem } from "../components/SegmentContextMenu";
import type { ProjectSummary } from "../tauri/projectApi";

function displayProjectName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export type ProjectContextMenuKey = "toggleExpand" | "revealLocation" | "rename" | "delete";

export function isProjectContextMenuKey(key: string): key is ProjectContextMenuKey {
  return (
    key === "toggleExpand" ||
    key === "revealLocation" ||
    key === "rename" ||
    key === "delete"
  );
}

export function buildProjectContextMenuItems(input: {
  isExpanded: boolean;
  busy?: boolean;
}): ContextMenuItem[] {
  const busy = Boolean(input.busy);
  return [
    {
      key: "toggleExpand",
      label: input.isExpanded ? "收起文件列表" : "展开文件列表",
      disabled: busy,
    },
    { key: "revealLocation", label: "打开所在位置", disabled: busy },
    { key: "rename", label: "重命名", disabled: busy },
    { key: "delete", label: "删除项目", disabled: busy },
  ];
}

export type ProjectFileContextMenuKey =
  | "open"
  | "revealLocation"
  | "rename"
  | "delete"
  | `move:${string}`
  | `copy:${string}`;

export function isProjectFileContextMenuKey(key: string): key is ProjectFileContextMenuKey {
  return (
    key === "open" ||
    key === "revealLocation" ||
    key === "rename" ||
    key === "delete" ||
    key.startsWith("move:") ||
    key.startsWith("copy:")
  );
}

export function parseMoveDestProjectId(key: string): string | null {
  if (!key.startsWith("move:")) return null;
  const id = key.slice("move:".length);
  return id.length > 0 ? id : null;
}

export function parseCopyDestProjectId(key: string): string | null {
  if (!key.startsWith("copy:")) return null;
  const id = key.slice("copy:".length);
  return id.length > 0 ? id : null;
}

function projectSubmenuChildren(
  projects: readonly ProjectSummary[],
  prefix: "move" | "copy",
  sourceProjectId: string,
  includeSource: boolean,
  busy: boolean,
): ContextMenuItem[] {
  const list = includeSource
    ? projects
    : projects.filter((p) => p.id !== sourceProjectId);
  return list.map((p) => ({
    key: `${prefix}:${p.id}`,
    label:
      p.id === sourceProjectId
        ? `${displayProjectName(p.name)}（当前）`
        : displayProjectName(p.name),
    disabled: busy,
  }));
}

export function buildProjectFileContextMenuItems(input: {
  sourceProjectId: string;
  projects: readonly ProjectSummary[];
  busy?: boolean;
}): ContextMenuItem[] {
  const busy = Boolean(input.busy);
  const moveChildren = projectSubmenuChildren(
    input.projects,
    "move",
    input.sourceProjectId,
    false,
    busy,
  );
  const copyChildren = projectSubmenuChildren(
    input.projects,
    "copy",
    input.sourceProjectId,
    true,
    busy,
  );

  return [
    { key: "open", label: "打开", disabled: busy },
    { key: "revealLocation", label: "打开所在位置", disabled: busy },
    {
      key: "move",
      label: "移动到…",
      disabled: busy || moveChildren.length === 0,
      children: moveChildren.length > 0 ? moveChildren : undefined,
    },
    {
      key: "copy",
      label: "复制到…",
      disabled: busy || copyChildren.length === 0,
      children: copyChildren.length > 0 ? copyChildren : undefined,
    },
    { key: "rename", label: "重命名", disabled: busy },
    { key: "delete", label: "删除", disabled: busy },
  ];
}
