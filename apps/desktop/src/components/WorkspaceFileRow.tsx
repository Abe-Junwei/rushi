import { PANEL_TYPOGRAPHY } from "../config/typography";
import { WORKSPACE_FILE_ROW_CLASS } from "../config/workspaceShellLayout";
import type { ReactNode } from "react";

interface WorkspaceFileRowProps {
  name: string;
  meta: string;
  busy?: boolean;
  selected?: boolean;
  onOpen: () => void;
  actionSlot?: ReactNode;
}

/**
 * Welcome / Hub 共用文件列表行：
 * - hover 背景
 * - 文件名 + meta
 * - "打开" 文字（hover/focus-visible 显）
 * - 可选右侧操作按钮（actionSlot）
 */
export function WorkspaceFileRow({
  name,
  meta,
  busy,
  selected = false,
  onOpen,
  actionSlot,
}: WorkspaceFileRowProps) {
  return (
    <div
      className={[
        WORKSPACE_FILE_ROW_CLASS,
        "pr-1",
        selected ? "bg-notion-sidebar-active" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent px-2.5 py-2 text-left disabled:opacity-40"
        disabled={busy}
        onClick={() => void onOpen()}
      >
        <span className="min-w-0 flex-1 pr-3">
          <span className="block truncate text-sm font-medium text-notion-text">
            {name}
          </span>
          <span
            className={`block truncate ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}
          >
            {meta}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-zen-saffron opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          打开
        </span>
      </button>
      {actionSlot ? (
        <div className="flex shrink-0 items-center pr-1">{actionSlot}</div>
      ) : null}
    </div>
  );
}
