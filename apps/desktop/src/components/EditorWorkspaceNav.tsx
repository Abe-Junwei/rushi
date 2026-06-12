import { ChevronLeft, PanelLeftOpen } from "lucide-react";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

/** 工作区顶栏：图标后退 + 面包屑（常态无灰底，hover 才显底） */
const NAV_ICON_BTN =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent p-0 text-notion-text-muted shadow-none transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 侧栏折叠态：顶栏展开钮略向左贴齐主区左缘 */
const NAV_SIDEBAR_EXPAND_BTN = `${NAV_ICON_BTN} -ml-2.5`;

const PROJECT_LINK =
  "min-w-0 max-w-[40%] truncate rounded-sm border-0 bg-transparent p-0 text-left text-[13px] font-medium text-notion-text-muted shadow-none transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

export type EditorWorkspaceNavProps = {
  projectName: string;
  currentLabel: string;
  /** 当前打开文件有未保存语段修改 */
  hasUnsavedEdits?: boolean;
  /** Chevron：打开文件时回到项目内页；未打开文件时离开项目 */
  onBack: () => void;
  /** 已打开文件时点击项目名，与 onBack 同为回到项目文件列表 */
  onProjectHome?: () => void;
  fileOpen: boolean;
  backLabel?: string;
  disabled?: boolean;
  /** 侧栏折叠时：在导航前显示 ghost 展开钮（与 Chevron 同套样式） */
  workspaceSidebarCollapsed?: boolean;
  onExpandWorkspaceSidebar?: () => void;
};

/**
 * Notion / Linear 式页头导航：Chevron + 可点项目名 + 当前文件；窄屏仅显示当前页。
 */
export function EditorWorkspaceNav({
  projectName,
  currentLabel,
  onBack,
  onProjectHome,
  fileOpen,
  backLabel,
  disabled = false,
  hasUnsavedEdits = false,
  workspaceSidebarCollapsed = false,
  onExpandWorkspaceSidebar,
}: EditorWorkspaceNavProps) {
  const resolvedBackLabel =
    backLabel ?? (fileOpen ? "返回项目文件列表" : "返回项目列表");
  const projectAction = fileOpen && onProjectHome ? onProjectHome : undefined;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      {workspaceSidebarCollapsed && onExpandWorkspaceSidebar ? (
        <button
          type="button"
          className={`${NAV_SIDEBAR_EXPAND_BTN} workspace-nav-sidebar-expand-btn`}
          disabled={disabled}
          onClick={onExpandWorkspaceSidebar}
          aria-label="展开侧栏"
          title="展开项目侧栏"
        >
          <PanelLeftOpen className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={NAV_ICON_BTN}
        disabled={disabled}
        onClick={onBack}
        aria-label={resolvedBackLabel}
        title={resolvedBackLabel}
      >
        <ChevronLeft className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <nav
        className="flex min-w-0 flex-1 items-center overflow-hidden pl-0.5"
        aria-label="当前位置"
      >
        {/* 窄屏：仅当前页（打开文件时）或仅项目名（项目内页） */}
        <span
          className="min-w-0 truncate text-[13px] font-semibold text-notion-text md:hidden"
          title={fileOpen ? currentLabel : projectName}
        >
          {fileOpen ? currentLabel : projectName}
        </span>

        {/* md+：完整面包屑 */}
        <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-hidden md:flex">
          {projectAction ? (
            <button
              type="button"
              className={PROJECT_LINK}
              disabled={disabled}
              onClick={projectAction}
              title={`返回项目：${projectName}`}
            >
              {projectName}
            </button>
          ) : (
            <span
              className="min-w-0 max-w-[40%] truncate text-[13px] font-medium text-notion-text-muted"
              title={projectName}
            >
              {projectName}
            </span>
          )}
          <span className="shrink-0 text-[12px] text-notion-text-light" aria-hidden>
            /
          </span>
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-semibold text-notion-text"
            title={currentLabel}
          >
            {hasUnsavedEdits ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-zen-saffron"
                  title="有未保存修改"
                  aria-hidden
                />
                <span className="truncate">{currentLabel}</span>
              </span>
            ) : (
              currentLabel
            )}
          </span>
        </div>
      </nav>
    </div>
  );
}
