import { useState, type ReactNode } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { WORKSPACE_FILE_ROW_CLASS } from "../config/workspaceShellLayout";
import { HoverRevealText } from "./HoverRevealText";
import { WELCOME_SIDEBAR_FILE_INDENT } from "./welcomeSidebarFormatters";

interface WorkspaceFileRowProps {
  name: string;
  meta: string;
  busy?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  actionSlot?: ReactNode;
  /** sidebar：嵌套于项目下，小字 + 缩进；panel：主舞台列表（默认） */
  variant?: "panel" | "sidebar";
}

/**
 * Welcome / Hub 共用文件列表行：
 * - hover 背景
 * - 文件名 + meta
 * - 可选右侧操作按钮（actionSlot）
 */
export function WorkspaceFileRow({
  name,
  meta,
  busy,
  selected = false,
  onOpen,
  onContextMenu,
  actionSlot,
  variant = "panel",
}: WorkspaceFileRowProps) {
  const isSidebar = variant === "sidebar";
  const [rowHovered, setRowHovered] = useState(false);

  return (
    <div
      className={[
        WORKSPACE_FILE_ROW_CLASS,
        selected ? "bg-notion-sidebar-active hover:bg-notion-sidebar-active" : "",
      ].join(" ")}
      onContextMenu={onContextMenu}
    >
      <button
        type="button"
        className={[
          "flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent text-left disabled:opacity-40",
          isSidebar ? `${WELCOME_SIDEBAR_FILE_INDENT} py-1.5` : "px-5 py-2",
        ].join(" ")}
        disabled={busy}
        onClick={() => void onOpen()}
        title={name}
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
        onFocus={() => setRowHovered(true)}
        onBlur={() => setRowHovered(false)}
      >
        <span className="min-w-0 flex-1">
          <HoverRevealText
            text={name}
            revealed={rowHovered}
            className={[
              isSidebar
                ? selected
                  ? "text-body font-medium text-notion-text"
                  : "text-body font-normal text-notion-text-muted group-hover:text-notion-text"
                : "text-sm font-medium text-notion-text",
            ].join(" ")}
          />
          <span
            className={[
              "block truncate",
              isSidebar
                ? "text-label leading-4 text-notion-text-light"
                : `${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`,
            ].join(" ")}
          >
            {meta}
          </span>
        </span>
      </button>
      {actionSlot ? <div className="flex shrink-0 items-center pr-5">{actionSlot}</div> : null}
    </div>
  );
}
