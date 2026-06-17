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
  actionSlot?: ReactNode;
  /** sidebar：嵌套于项目下，小字 + 缩进；panel：主舞台列表（默认） */
  variant?: "panel" | "sidebar";
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
        <span className="min-w-0 flex-1 pr-3">
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
        <span className="shrink-0 text-label font-medium text-zen-saffron opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          打开
        </span>
      </button>
      {actionSlot ? <div className="flex shrink-0 items-center pr-5">{actionSlot}</div> : null}
    </div>
  );
}
