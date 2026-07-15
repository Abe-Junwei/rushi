/**
 * 项目坞控件 — 对齐仓库根 DESIGN.md Notion Zen button / input 语义。
 * 标准：h-8 (32px)、rounded-sm (4px)、无常态 shadow。
 *
 * ## Ghost 尺寸阶梯（勿合并为单一 token）
 * - `CONTROL_BTN_GHOST` — 对话框 / 面板标准 ghost（h-8 · px-4 · semibold）
 * - `CONTROL_BTN_TOOLBAR_GHOST` — 顶栏 / 工作条（h-8 · px-2.5 · medium）
 * - `CONTROL_BTN_WORKSPACE_IMPORT` — Hub 行内导入（h-7 · px-2 · medium）
 * - `CONTROL_BTN_ICON_GHOST` — 28px 纯图标 ghost
 *
 * ## Compact secondary 分工
 * - `CONTROL_BTN_COMPACT_SECONDARY` — 表格 / 列表工具（h-7 · text-label · semibold · sidebar 底）
 * - `ENV_COMPACT_BTN` — 环境页 / 热词批量条工具行（py-1 · text-body · medium · notion-bg 底）
 *
 * ## 波形工作条（`waveform.css`）
 * 40px 行内 engaged / toggle-active 态走 `.icon-btn`、`.workbench-label-btn` 等 CSS 类；
 * 面板与对话框仍用本文件 `CONTROL_*`。见 `docs/architecture/desktop-visual-style-governance.md` §按钮真源。
 */

/** `button-primary`：saffron 底 + 白字；hover 深 saffron */
export const CONTROL_BTN_PRIMARY =
  "inline-flex h-8 min-h-8 items-center justify-center rounded-sm border border-transparent bg-zen-primary-action-bg px-4 font-sans text-body font-semibold text-zen-primary-action-fg shadow-none ring-0 transition-colors hover:bg-zen-primary-action-bg-hover hover:text-zen-primary-action-fg-hover focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/30 disabled:cursor-not-allowed disabled:opacity-40";

/** `button-secondary`：notion-sidebar 底 + hairline */
export const CONTROL_BTN_SECONDARY =
  "inline-flex h-8 min-h-8 items-center justify-center rounded-sm border border-notion-border bg-notion-sidebar px-4 font-sans text-body font-semibold text-notion-text shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar-hover focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 幽灵/第三态：透明底，hover sidebar */
export const CONTROL_BTN_GHOST =
  "inline-flex h-8 min-h-8 items-center justify-center rounded-sm border border-transparent bg-transparent px-4 font-sans text-body font-semibold text-notion-text-muted shadow-none ring-0 transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 顶栏 / 工作条 ghost（12px medium，较标准 ghost 更窄 padding） */
export const CONTROL_BTN_TOOLBAR_GHOST =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-sm border-0 bg-transparent px-2.5 font-sans text-body font-medium text-notion-text-muted shadow-none ring-0 transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** Welcome / Hub 行内导入动作（28px 高 ghost + 图标） */
export const CONTROL_BTN_WORKSPACE_IMPORT =
  "inline-flex h-7 min-h-7 shrink-0 items-center justify-center gap-1.5 rounded-sm border-0 bg-transparent px-2 font-sans text-body font-medium text-notion-text-muted shadow-none ring-0 transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 列表内紧凑 secondary（全选等） */
export const CONTROL_BTN_COMPACT_SECONDARY =
  "inline-flex h-7 items-center justify-center rounded-sm border border-notion-border bg-notion-sidebar px-2.5 font-sans text-label font-semibold text-notion-text shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 行内文字链式按钮（透明底 + 下划线 hover；须再叠 text-* 色） */
export const CONTROL_BTN_LINK =
  "border-0 bg-transparent p-0 font-inherit shadow-none ring-0 appearance-none underline-offset-2 transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40";

/** 危险操作：白底 + cinnabar 边/字；hover 填 cinnabar */
export const CONTROL_BTN_DANGER =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-sm border border-zen-cinnabar bg-notion-bg px-4 font-sans text-body font-semibold text-zen-cinnabar shadow-none ring-0 transition-colors hover:border-zen-cinnabar hover:bg-zen-cinnabar hover:text-notion-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-cinnabar/30 disabled:cursor-not-allowed disabled:opacity-40";

/** 危险操作紧凑 */
export const CONTROL_BTN_DANGER_COMPACT =
  "inline-flex h-7 items-center justify-center rounded-sm border border-zen-cinnabar bg-notion-bg px-3 font-sans text-label font-semibold text-zen-cinnabar transition-colors hover:bg-zen-cinnabar hover:text-notion-bg disabled:cursor-not-allowed disabled:opacity-40";

/** `text-input`：白底 + hairline + saffron focus */
export const CONTROL_TEXT_INPUT =
  "box-border block w-full h-8 min-h-8 rounded-sm border border-notion-border bg-notion-bg px-3 py-1.5 font-sans text-sm font-normal leading-snug text-notion-text shadow-none ring-0 outline-none transition-colors placeholder:text-notion-text-light focus:border-accent-action focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-action/25 disabled:cursor-not-allowed disabled:opacity-40";

/** 与 text-input 同高，保留系统下拉箭头 */
export const CONTROL_SELECT =
  "box-border h-8 min-h-8 w-full min-w-[11rem] cursor-pointer rounded-sm border border-notion-border bg-notion-bg py-0 pl-3 pr-9 font-sans text-sm font-medium text-notion-text-muted shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 disabled:opacity-40";

/** 欢迎页 / 建项 hero CTA：40px 高，仍 4px 圆角（DESIGN § Prominent controls） */
export const CONTROL_BTN_PRIMARY_PROMINENT =
  "inline-flex h-10 min-h-10 items-center justify-center rounded-sm border border-transparent bg-zen-primary-action-bg px-5 font-sans text-sm font-semibold text-zen-primary-action-fg shadow-none ring-0 transition-colors hover:bg-zen-primary-action-bg-hover hover:text-zen-primary-action-fg-hover focus:shadow-none focus:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/30 disabled:cursor-not-allowed disabled:opacity-40";

export const CONTROL_BTN_SECONDARY_PROMINENT =
  "inline-flex h-10 min-h-10 items-center justify-center rounded-sm border border-notion-border bg-notion-sidebar px-5 font-sans text-sm font-semibold text-notion-text shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar-hover focus:shadow-none focus:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 图标-only 工具按钮：secondary 形，32px 方块（刷新等） */
export const CONTROL_BTN_ICON =
  "inline-flex h-8 w-8 min-h-8 shrink-0 items-center justify-center rounded-sm border border-notion-border bg-notion-bg font-sans text-body text-notion-text-muted shadow-none ring-0 transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 图标-only ghost：28px 方块，无边框（Hub 行操作 / 历史图标 / 顶栏 nav） */
export const CONTROL_BTN_ICON_GHOST =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent p-0 font-sans text-notion-text-muted shadow-none ring-0 transition-[color,background-color,opacity] hover:bg-notion-sidebar-hover hover:text-notion-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 欢迎页顶栏大图标 ghost（圆形 hit area，如活动铃） */
export const CONTROL_BTN_WELCOME_ICON =
  "relative inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-2 font-sans text-notion-text-muted shadow-none outline-none transition-colors hover:bg-notion-sidebar-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text-light/40 disabled:cursor-not-allowed disabled:opacity-50";

/** 顶栏状态芯片（FFmpeg / ASR / LLM 就绪；无固定高度，随 label 内容） */
export const CONTROL_BTN_STATUS_CHIP =
  "inline-flex items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 font-sans shadow-none outline-none transition-colors hover:bg-notion-sidebar-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text-light/40 disabled:cursor-not-allowed disabled:opacity-50";

/** 编辑页顶栏面包屑可点段（truncate + title 字号） */
export const CONTROL_BTN_BREADCRUMB =
  "min-w-0 max-w-[40%] truncate rounded-sm border-0 bg-transparent p-0 text-left font-sans text-title font-medium text-notion-text-muted shadow-none transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 多行文本输入：与 text-input 同语义，高度自适应、允许纵向 resize */
export const CONTROL_TEXTAREA =
  "box-border block w-full max-w-full min-w-0 resize-y rounded-sm border border-notion-border bg-notion-bg px-3 py-2 font-sans text-sm font-normal leading-snug text-notion-text shadow-none ring-0 outline-none transition-colors placeholder:text-notion-text-light focus:border-accent-action focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-action/25 disabled:cursor-not-allowed disabled:opacity-40";

/** 工具栏内联 select：与 CONTROL_SELECT 同观感，宽度随内容 */
export const CONTROL_SELECT_INLINE =
  "box-border h-8 min-h-8 cursor-pointer rounded-sm border border-notion-border bg-notion-bg py-0 pl-3 pr-9 font-sans text-sm font-medium text-notion-text-muted shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 disabled:opacity-40";

/** 环境页紧凑工具按钮（诊断 / 缓存 / 侧车等） */
export const ENV_COMPACT_BTN =
  "inline-flex items-center gap-1.5 rounded-sm border border-notion-border bg-notion-bg px-2.5 py-1 font-sans text-body font-medium leading-[1.4] text-notion-text shadow-none transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-40";

/** 环境页 mono 技术输入（基于 CONTROL_TEXT_INPUT） */
export const ENV_MONO_FIELD =
  "block w-full font-mono text-body leading-[1.4] text-notion-text placeholder:text-notion-text-light";

/** LLM 模式状态切换：居中行 */
export const ENV_SEGMENTED_ROW = "flex w-full justify-center";

/** LLM 模式状态切换轨道（Stitch：secondary-container 底 + 选中项白底） */
export const ENV_LLM_MODE_TOGGLE_TRACK =
  "inline-flex gap-0 rounded-lg bg-secondary-container p-1";

/** 紧凑分段 toggle 轨道（对话框内 / 元数据字段标签旁） */
export const ENV_SEGMENTED_TOGGLE_TRACK_COMPACT =
  "inline-flex shrink-0 gap-0 rounded-md bg-secondary-container p-0.5";

const ENV_LLM_MODE_TOGGLE_BTN_BASE =
  "min-w-[7.5rem] rounded-md border-0 px-4 py-1.5 text-center font-sans text-title font-medium whitespace-nowrap shadow-none ring-0 appearance-none transition-[color,background-color,box-shadow] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/30 disabled:cursor-not-allowed disabled:opacity-40";

const ENV_SEGMENTED_TOGGLE_BTN_BASE_COMPACT =
  "rounded-[5px] border-0 px-2.5 py-0.5 text-center font-sans text-xs font-medium leading-none whitespace-nowrap shadow-none ring-0 appearance-none transition-[color,background-color,box-shadow] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/30 disabled:cursor-not-allowed disabled:opacity-40";

export function envSegmentedToggleTrackClass(compact = false): string {
  return compact ? ENV_SEGMENTED_TOGGLE_TRACK_COMPACT : ENV_LLM_MODE_TOGGLE_TRACK;
}

function segmentedToggleBtnSelectedClass(base: string): string {
  return `${base} bg-notion-bg text-accent-action-strong shadow-[0_1px_2px_rgba(0,0,0,0.06)]`;
}

function segmentedToggleBtnIdleClass(base: string): string {
  return `${base} bg-transparent text-notion-text-variant hover:text-notion-text`;
}

/** 分段 toggle 项；compact 用于对话框 / 字段内三选一 */
export function envSegmentedToggleBtnClass(selected: boolean, compact = false): string {
  const base = compact ? ENV_SEGMENTED_TOGGLE_BTN_BASE_COMPACT : ENV_LLM_MODE_TOGGLE_BTN_BASE;
  return selected ? segmentedToggleBtnSelectedClass(base) : segmentedToggleBtnIdleClass(base);
}

/** 状态切换项：选中 = 白底 + shadow + primary 字色；未选 = 透明底 + on-surface-variant */
export function envLlmModeToggleBtnClass(selected: boolean): string {
  return envSegmentedToggleBtnClass(selected, false);
}
