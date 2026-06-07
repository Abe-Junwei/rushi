/** 欢迎页 / 项目 Hub 共用双栏壳层（侧栏 20rem + 主区） */
export const WORKSPACE_SHELL_GRID_CLASS =
  "grid h-full min-h-0 w-full flex-1 grid-cols-[20rem_1fr]";

/**
 * 双栏首页壳层标记 — 须与 `apps/desktop/src/styles/shell.css` 中
 * `.shell:has([data-purpose=…])` 选择器保持同步，否则 Hub 会落入 .shell 默认 padding。
 */
export const WORKSPACE_HOME_SHELL_PURPOSE = "workspace-home-shell";

/** TopBar 下方主舞台：自顶向下滚动，顶距见 workspace.css `--workspace-home-stage-offset-top` */
export const WORKSPACE_HOME_STAGE_CLASS =
  "welcome-home-stage flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg";

/** Stage 内容页水平留白容器；顶距由 stage 壳层 padding-top 控制 */
export const WORKSPACE_HOME_PAGE_CLASS = "welcome-home-page";

/** 开放式内容页宽度 — Welcome / Hub / 空项目页，不自带边框、圆角或阴影 */
export const WORKSPACE_PAGE_PANEL_CLASS = "relative flex w-full max-w-[672px] flex-col";

/** 文件列表行 — Welcome / Hub 共用：常态透明，hover 浅灰 */
export const WORKSPACE_FILE_ROW_CLASS =
  "group flex w-full items-center rounded-md bg-transparent text-left transition-colors hover:bg-notion-sidebar-hover";
