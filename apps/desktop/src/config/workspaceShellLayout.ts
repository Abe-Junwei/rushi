/** 欢迎页 / 项目 Hub / 编辑页共用侧栏宽度 */
import { MAIN_SHELL_SURFACE_CLASS } from "./shellVisualTokens";

/** 固定侧栏双栏 grid（Welcome / Hub）— 列宽见 workspace.css `.workspace-shell-fixed` */
export const WORKSPACE_SHELL_GRID_CLASS =
  "workspace-shell-fixed grid h-full min-h-0 w-full flex-1";

/** 可折叠侧栏壳层 — overlay + transform，主区宽度不变，见 workspace.css */
export const WORKSPACE_SHELL_COLLAPSIBLE_CLASS =
  "workspace-shell-collapsible grid h-full min-h-0 w-full flex-1 grid-cols-1";

export const WORKSPACE_SIDEBAR_PANEL_ATTR = "data-workspace-sidebar-panel";
export const WORKSPACE_SIDEBAR_TOGGLE_ATTR = "data-workspace-sidebar-toggle";

/**
 * 双栏首页壳层标记 — 须与 `apps/desktop/src/styles/shell.css` 中
 * `.shell:has([data-purpose=…])` 选择器保持同步，否则 Hub 会落入 .shell 默认 padding。
 */
export const WORKSPACE_HOME_SHELL_PURPOSE = "workspace-home-shell";

/** 编辑页可折叠侧栏壳层 — 与 welcome 同样 full-bleed */
export const WORKSPACE_EDITOR_SHELL_PURPOSE = "editor-workspace-shell";

/** EditorToolbar 行高（Tailwind `h-12`）— 侧栏 overlay 顶 inset 须与此对齐 */
export const EDITOR_WORKSPACE_TOOLBAR_HEIGHT = "3rem";

/** `.editor-status-footer` 固定高度 — 侧栏 overlay 底 inset 须与此对齐 */
export const EDITOR_WORKSPACE_FOOTER_HEIGHT = "30px";

/** Welcome / Editor TopBar 搜索与活动铃铛下拉 — 宽度与壳层真源（须同步） */
export const WELCOME_TOPBAR_DROPDOWN_PANEL_CLASS =
  "absolute right-0 top-full mt-1 w-[min(28rem,calc(100vw-5rem))] overflow-hidden rounded-md border border-notion-border bg-notion-bg shadow-lg";

/** 下拉面板上缘工具条（搜索 scope 行 / 活动标题行） */
export const WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS =
  "border-b border-notion-border bg-notion-sidebar/40";

/** 上缘工具条内边距 — 与 WelcomeSearchScopeChips 一致 */
export const WELCOME_TOPBAR_DROPDOWN_HEADER_INSET_CLASS = "px-2.5 py-1.5";

/** TopBar 下方主舞台：自顶向下滚动，顶距见 workspace.css `--workspace-home-stage-offset-top` */
export const WORKSPACE_HOME_STAGE_CLASS = `welcome-home-stage flex min-h-0 flex-1 flex-col overflow-y-auto ${MAIN_SHELL_SURFACE_CLASS.pageBg}`;

/** Stage 内容页水平留白容器；顶距由 stage 壳层 padding-top 控制 */
export const WORKSPACE_HOME_PAGE_CLASS = "welcome-home-page";

/** 开放式内容页宽度 — Welcome / Hub / 空项目页，不自带边框、圆角或阴影 */
export const WORKSPACE_PAGE_PANEL_CLASS = "relative flex w-full max-w-[672px] flex-col";

/** 文件列表行 — Welcome / Hub 共用：全宽贴边、无圆角 */
export const WORKSPACE_FILE_ROW_CLASS =
  "group flex w-full items-center bg-transparent text-left transition-colors hover:bg-notion-sidebar-hover";

/** 侧栏主功能区导航栈（Notion：左右内缩 + 项间 gap） */
export const WORKSPACE_SIDEBAR_NAV_STACK = "flex flex-col gap-0.5 px-3 pb-3";

const WORKSPACE_SIDEBAR_NAV_ITEM_BASE =
  "flex w-full min-h-10 items-center gap-3 rounded-md border-0 px-3 py-2.5 text-left text-sm font-medium leading-snug transition-colors";

/** 主页面切换项：圆角块 + 40px 最小高度，区别于贴边工具行 */
export function workspaceSidebarNavItemClass(opts: { active?: boolean; disabled?: boolean }): string {
  if (opts.disabled) {
    return `${WORKSPACE_SIDEBAR_NAV_ITEM_BASE} cursor-not-allowed text-notion-text-light opacity-40`;
  }
  return opts.active
    ? `${WORKSPACE_SIDEBAR_NAV_ITEM_BASE} bg-notion-sidebar-active font-semibold text-notion-text`
    : `${WORKSPACE_SIDEBAR_NAV_ITEM_BASE} bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text`;
}

const WORKSPACE_SIDEBAR_SUBNAV_ITEM_BASE =
  "flex w-full min-h-9 items-center gap-2 rounded-md border-0 py-2 pl-9 pr-3 text-left text-title font-medium leading-snug transition-colors";

/** 主功能下的子工作区（如热词与记忆三分段） */
export function workspaceSidebarSubNavItemClass(active: boolean): string {
  return active
    ? `${WORKSPACE_SIDEBAR_SUBNAV_ITEM_BASE} bg-notion-sidebar-active font-semibold text-accent-action`
    : `${WORKSPACE_SIDEBAR_SUBNAV_ITEM_BASE} bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text`;
}

/** 侧栏底栏：上手清单 / 设置 等宽横排 */
export const WORKSPACE_SIDEBAR_FOOTER_GRID = "grid gap-0.5 px-3 py-2";

const WORKSPACE_SIDEBAR_FOOTER_ITEM_BASE =
  "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-md border-0 px-1 py-2 text-center text-label font-medium leading-tight transition-colors";

/** 底栏横排项：图标 + 短标签，等宽平级 */
export function workspaceSidebarFooterItemClass(opts: { active?: boolean }): string {
  return opts.active
    ? `${WORKSPACE_SIDEBAR_FOOTER_ITEM_BASE} bg-notion-sidebar-active text-notion-text`
    : `${WORKSPACE_SIDEBAR_FOOTER_ITEM_BASE} bg-transparent text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text`;
}

/** 侧栏块级行容器（项目行等）：全宽贴边、无圆角 */
export const WORKSPACE_SIDEBAR_ROW_SURFACE = "w-full transition-colors";

/** 侧栏项目展开区「暂无文件」提示行（全宽 ghost，非 nav item 块） */
export const WORKSPACE_SIDEBAR_EMPTY_HINT_BTN =
  "w-full appearance-none border-0 bg-transparent px-5 py-2 text-left font-sans text-label text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";
