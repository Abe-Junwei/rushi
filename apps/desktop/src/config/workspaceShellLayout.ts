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

/** 欢迎页搜索结果下拉（比活动铃面板更窄） */
export const WELCOME_SEARCH_DROPDOWN_PANEL_CLASS =
  "absolute right-0 top-full mt-1 w-[min(18rem,calc(100vw-5rem))] overflow-hidden rounded-md border border-notion-border bg-notion-bg shadow-lg";

/** 下拉面板上缘工具条（搜索 scope 行 / 活动标题行） */
export const WELCOME_TOPBAR_DROPDOWN_HEADER_STRIP_CLASS =
  "border-b border-notion-border bg-notion-sidebar/40";

/** 上缘工具条内边距 — 与 WelcomeSearchScopeChips 一致 */
export const WELCOME_TOPBAR_DROPDOWN_HEADER_INSET_CLASS = "px-2.5 py-1.5";

/** TopBar 下方主舞台：自顶向下滚动，顶距见 workspace.css `--workspace-home-stage-offset-top` */
/** 欢迎 / Hub 主舞台：占满侧栏旁列高，禁止整页滚动（列表超高走分页） */
export const WORKSPACE_HOME_STAGE_CLASS = `welcome-home-stage flex min-h-0 flex-1 flex-col overflow-hidden ${MAIN_SHELL_SURFACE_CLASS.pageBg}`;

/** Stage 内容页水平留白容器；顶距由 stage 壳层 padding-top 控制 */
export const WORKSPACE_HOME_PAGE_CLASS = "welcome-home-page";

/** 开放式内容页宽度 — Welcome / Hub / 空项目页，不自带边框、圆角或阴影 */
export const WORKSPACE_PAGE_PANEL_CLASS = "relative flex w-full max-w-[672px] flex-col";

/**
 * 欢迎页主区垂直栈（hero / onboarding / ledger）。
 * 8px 网格 · DESIGN「区块 24px」；与 ledger 顶分割线下方 `pt-4`(16) 组成 ≈1.5 段间比（近 φ）。
 */
export const WELCOME_HOME_STACK_GAP = "gap-6";

/** 文件列表行 — Welcome / Hub 共用：全宽贴边、无圆角 */
export const WORKSPACE_FILE_ROW_CLASS =
  "group flex w-full items-center bg-transparent text-left transition-colors hover:bg-notion-sidebar-hover";

/**
 * 欢迎页 ledger 水平内边距（tab 栏与行共用，对齐设计稿 px-6）。
 */
export const WELCOME_LEDGER_INSET_X = "px-6";

/**
 * 「所有文件」嵌套文件行水平内边距：相对项目行缩进
 * （ledger px-6 + 文件夹图标 28px + gap-2 ≈ pl-16，右侧仍 pr-6）。
 */
export const WELCOME_LEDGER_NESTED_FILE_INSET_X = "pl-16 pr-6";

/** 欢迎页 ledger 分割线下方内边距（与 `WELCOME_HOME_STACK_GAP` 成对） */
export const WELCOME_LEDGER_DIVIDER_PT = "pt-4";

/** 欢迎页 ledger tab 间距（8 网格：24px） */
export const WELCOME_LEDGER_TAB_GAP = "gap-6";

/** tab 栏 → 列表（8 网格：16px） */
export const WELCOME_LEDGER_TAB_MB = "mb-4";

/**
 * 欢迎页 ledger 行垂直留白（compact–comfortable：与字号行高预算对齐）。
 * title 20 + meta gap 2 + meta 16 + py-2×2(16) = 54px → 分页预算 56。
 */
export const WELCOME_LEDGER_ROW_Y = "py-2";

/** 侧栏主功能区导航栈（设计稿 space-y-6：三项主 tab 间距 24px） */
export const WORKSPACE_SIDEBAR_NAV_STACK = "flex flex-col gap-6 px-5 pb-6";

const WORKSPACE_SIDEBAR_NAV_ITEM_BASE =
  "flex w-full min-h-9 items-center gap-3 rounded-sm border-0 px-2 py-2 text-left text-title font-medium leading-snug transition-colors";

/** 主页面切换项：图示气质 — 激活靠字重/色，无厚底圆角块 */
export function workspaceSidebarNavItemClass(opts: { active?: boolean; disabled?: boolean }): string {
  if (opts.disabled) {
    return `${WORKSPACE_SIDEBAR_NAV_ITEM_BASE} cursor-not-allowed text-notion-text-light opacity-40`;
  }
  return opts.active
    ? `${WORKSPACE_SIDEBAR_NAV_ITEM_BASE} bg-transparent font-semibold text-notion-text`
    : `${WORKSPACE_SIDEBAR_NAV_ITEM_BASE} bg-transparent text-notion-text-muted hover:text-notion-text`;
}

const WORKSPACE_SIDEBAR_SUBNAV_ITEM_BASE =
  "flex w-full min-h-8 items-center gap-2 rounded-sm border-0 py-1.5 pl-8 pr-2 text-left text-title font-medium leading-snug transition-colors";

/** 主功能下的子工作区（如热词与记忆三分段） */
export function workspaceSidebarSubNavItemClass(active: boolean): string {
  return active
    ? `${WORKSPACE_SIDEBAR_SUBNAV_ITEM_BASE} bg-transparent font-semibold text-accent-action`
    : `${WORKSPACE_SIDEBAR_SUBNAV_ITEM_BASE} bg-transparent text-notion-text-muted hover:text-notion-text`;
}

/** 侧栏底栏：上手清单 / 设置 — 横排；按钮外观沿用原 ghost 图标+标签 */
export const WORKSPACE_SIDEBAR_FOOTER_STACK = "flex flex-row items-center gap-1 px-5 pb-4 pt-4";

const WORKSPACE_SIDEBAR_FOOTER_ITEM_BASE =
  "flex min-w-0 flex-1 items-center gap-3 rounded-md border-0 px-3 py-2.5 text-left text-sm font-medium leading-snug transition-colors";

/** 底栏项：图标 + 标签横排（外观同改前；容器为横排） */
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
