/** 欢迎页 / 项目 Hub / 编辑页共用侧栏宽度 */
export const WORKSPACE_SIDEBAR_WIDTH = "20rem";

/** 固定侧栏双栏 grid（Welcome / Hub） */
export const WORKSPACE_SHELL_GRID_CLASS =
  "grid h-full min-h-0 w-full flex-1 grid-cols-[20rem_1fr]";

/** 可折叠侧栏壳层 — 宽度由 CSS 变量控制 */
export const WORKSPACE_SHELL_COLLAPSIBLE_CLASS =
  "workspace-shell-collapsible grid h-full min-h-0 w-full flex-1 grid-cols-[var(--workspace-sidebar-width)_minmax(0,1fr)]";

export const WORKSPACE_SIDEBAR_PANEL_ATTR = "data-workspace-sidebar-panel";
export const WORKSPACE_SIDEBAR_TOGGLE_ATTR = "data-workspace-sidebar-toggle";

/**
 * 双栏首页壳层标记 — 须与 `apps/desktop/src/styles/shell.css` 中
 * `.shell:has([data-purpose=…])` 选择器保持同步，否则 Hub 会落入 .shell 默认 padding。
 */
export const WORKSPACE_HOME_SHELL_PURPOSE = "workspace-home-shell";

/** 编辑页可折叠侧栏壳层 — 与 welcome 同样 full-bleed */
export const WORKSPACE_EDITOR_SHELL_PURPOSE = "editor-workspace-shell";

/** TopBar 下方主舞台：自顶向下滚动，顶距见 workspace.css `--workspace-home-stage-offset-top` */
export const WORKSPACE_HOME_STAGE_CLASS =
  "welcome-home-stage flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg";

/** Stage 内容页水平留白容器；顶距由 stage 壳层 padding-top 控制 */
export const WORKSPACE_HOME_PAGE_CLASS = "welcome-home-page";

/** 开放式内容页宽度 — Welcome / Hub / 空项目页，不自带边框、圆角或阴影 */
export const WORKSPACE_PAGE_PANEL_CLASS = "relative flex w-full max-w-[672px] flex-col";

/** 文件列表行 — Welcome / Hub 共用：全宽贴边、无圆角 */
export const WORKSPACE_FILE_ROW_CLASS =
  "group flex w-full items-center bg-transparent text-left transition-colors hover:bg-notion-sidebar-hover";

/** 侧栏可点击行（导航、设置等）：全宽贴边、无圆角、内容 px-5 */
export const WORKSPACE_SIDEBAR_ROW_INTERACTIVE =
  "flex w-full items-center gap-3 border-0 px-5 py-2 text-sm font-medium transition-colors";

/** 侧栏块级行容器（项目行等）：全宽贴边、无圆角 */
export const WORKSPACE_SIDEBAR_ROW_SURFACE = "w-full transition-colors";
