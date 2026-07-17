import {
  IconArrowLeft as ArrowLeft,
  IconChevronRight as ChevronRight,
} from "@tabler/icons-react";
import {
  CONTROL_BTN_BREADCRUMB,
  CONTROL_BTN_ICON_GHOST,
} from "../config/controlStyles";
import { useOptionalWorkspaceSidebarCollapseContext } from "../hooks/useWorkspaceSidebarCollapseContext";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

/** 工作区顶栏：侧栏展开 / 返回（纯图标） */
const NAV_ICON_BTN = `${CONTROL_BTN_ICON_GHOST} shadow-none focus-visible:outline-offset-1`;

/** 侧栏折叠态：顶栏展开钮略向左贴齐主区左缘 */
const NAV_SIDEBAR_EXPAND_BTN = `${NAV_ICON_BTN} -ml-2.5`;

export type EditorWorkspaceNavProps = {
  projectName: string;
  currentLabel: string;
  /** 当前打开文件有未保存语段修改 */
  hasUnsavedEdits?: boolean;
  /** 打开文件时回到项目内页；未打开文件时离开项目 */
  onBack: () => void;
  /** 已打开文件时点击项目名，与 onBack 同为回到项目文件列表 */
  onProjectHome?: () => void;
  fileOpen: boolean;
  backLabel?: string;
  disabled?: boolean;
};

/**
 * Notion / Linear 式页头导航：← 返回 + 可点项目名 + 当前文件；窄屏仅显示当前页。
 * 侧栏展开与壳层折叠钮成对：折叠用 ←，展开用 →。
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
}: EditorWorkspaceNavProps) {
  const sidebarCollapse = useOptionalWorkspaceSidebarCollapseContext();
  const resolvedBackLabel =
    backLabel ?? (fileOpen ? "返回项目文件列表" : "返回项目列表");
  const projectAction = fileOpen && onProjectHome ? onProjectHome : undefined;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {sidebarCollapse?.collapsed ? (
        <button
          type="button"
          className={`${NAV_SIDEBAR_EXPAND_BTN} workspace-nav-sidebar-expand-btn`}
          disabled={disabled}
          onClick={sidebarCollapse.expand}
          aria-label="展开侧栏"
          title="展开项目侧栏"
        >
          <ChevronRight className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
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
        <ArrowLeft className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <nav
        className="flex min-w-0 flex-1 items-center overflow-hidden pl-1"
        aria-label="当前位置"
      >
        {/* 窄屏：仅当前页（打开文件时）或仅项目名（项目内页） */}
        <span
          className="min-w-0 truncate text-title font-semibold text-notion-text md:hidden"
          title={fileOpen ? currentLabel : projectName}
        >
          {fileOpen ? currentLabel : projectName}
        </span>

        {/* md+：完整面包屑 */}
        <div className="hidden min-w-0 flex-1 items-center gap-1.5 overflow-hidden md:flex">
          {projectAction ? (
            <button
              type="button"
              className={CONTROL_BTN_BREADCRUMB}
              disabled={disabled}
              onClick={projectAction}
              title={`返回项目：${projectName}`}
            >
              {projectName}
            </button>
          ) : (
            <span
              className="min-w-0 max-w-[40%] truncate text-title font-medium text-notion-text-muted"
              title={projectName}
            >
              {projectName}
            </span>
          )}
          <span className="shrink-0 text-body text-notion-text-light" aria-hidden>
            /
          </span>
          <span
            className="min-w-0 flex-1 truncate text-title font-semibold text-notion-text"
            title={currentLabel}
          >
            {hasUnsavedEdits ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-action"
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
