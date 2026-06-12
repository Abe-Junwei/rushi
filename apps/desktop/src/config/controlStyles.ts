/**
 * 项目坞控件 — 对齐仓库根 DESIGN.md Notion Zen button / input 语义。
 * 标准：h-8 (32px)、rounded-sm (4px)、无常态 shadow。
 */

/** `button-primary`：saffron 底 + 白字，4px 圆角 */
export const CONTROL_BTN_PRIMARY =
  "inline-flex h-8 min-h-[32px] items-center justify-center rounded-sm border border-transparent bg-zen-saffron px-4 font-sans text-sm font-semibold text-notion-bg shadow-none ring-0 transition-colors hover:bg-zen-saffron-mid focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40";

/** `button-secondary`：notion-sidebar 底 + hairline */
export const CONTROL_BTN_SECONDARY =
  "inline-flex h-8 min-h-[32px] items-center justify-center rounded-sm border border-notion-border bg-notion-sidebar px-4 font-sans text-sm font-semibold text-notion-text shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar-hover focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 在线 STT 入口：secondary 形 + saffron 发线 */
export const CONTROL_BTN_ONLINE_STT =
  "inline-flex h-8 min-h-[32px] shrink-0 items-center justify-center rounded-sm border border-zen-saffron/35 bg-notion-bg px-4 font-sans text-sm font-semibold text-notion-text shadow-none ring-0 transition-colors hover:border-zen-saffron/55 hover:bg-zen-saffron/10 focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/35 disabled:cursor-not-allowed disabled:opacity-40";

/** 幽灵/第三态：透明底，hover sidebar */
export const CONTROL_BTN_GHOST =
  "inline-flex h-8 min-h-[32px] items-center justify-center rounded-sm border border-transparent bg-transparent px-4 font-sans text-sm font-semibold text-notion-text-muted shadow-none ring-0 transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 行内文字链式按钮（透明底 + 下划线 hover；须再叠 text-* 色） */
export const CONTROL_BTN_LINK =
  "border-0 bg-transparent p-0 font-inherit shadow-none ring-0 appearance-none underline-offset-2 transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40";

/** 危险操作：白底 + cinnabar 边/字；hover 填 cinnabar */
export const CONTROL_BTN_DANGER =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-sm border border-zen-cinnabar bg-notion-bg px-4 font-sans text-sm font-semibold text-zen-cinnabar shadow-none ring-0 transition-colors hover:border-zen-cinnabar hover:bg-zen-cinnabar hover:text-notion-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-cinnabar/30 disabled:cursor-not-allowed disabled:opacity-40";

/** 危险操作紧凑 */
export const CONTROL_BTN_DANGER_COMPACT =
  "inline-flex h-7 items-center justify-center rounded-sm border border-zen-cinnabar bg-notion-bg px-3 font-sans text-[11px] font-semibold text-zen-cinnabar transition-colors hover:bg-zen-cinnabar hover:text-notion-bg disabled:cursor-not-allowed disabled:opacity-40";

/** `text-input`：白底 + hairline + saffron focus */
export const CONTROL_TEXT_INPUT =
  "block w-full h-8 min-h-[32px] rounded-sm border border-notion-border bg-notion-bg px-3 py-1.5 font-sans text-sm font-normal leading-snug text-notion-text shadow-none ring-0 outline-none transition-colors placeholder:text-notion-text-light focus:border-zen-saffron focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-zen-saffron/25 disabled:cursor-not-allowed disabled:opacity-40";

/** 与 text-input 同高，保留系统下拉箭头 */
export const CONTROL_SELECT =
  "h-8 min-h-[32px] w-full min-w-[11rem] cursor-pointer rounded-sm border border-notion-border bg-notion-bg py-0 pl-3 pr-9 font-sans text-sm font-medium text-notion-text-muted shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 disabled:opacity-40";

/** 欢迎页 / 建项 hero CTA：40px 高，仍 4px 圆角（DESIGN § Prominent controls） */
export const CONTROL_BTN_PRIMARY_PROMINENT =
  "inline-flex h-10 min-h-[40px] items-center justify-center rounded-sm border border-transparent bg-zen-saffron px-5 font-sans text-sm font-semibold text-notion-bg shadow-none ring-0 transition-colors hover:bg-zen-saffron-mid focus:shadow-none focus:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40";

export const CONTROL_BTN_SECONDARY_PROMINENT =
  "inline-flex h-10 min-h-[40px] items-center justify-center rounded-sm border border-notion-border bg-notion-sidebar px-5 font-sans text-sm font-semibold text-notion-text shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar-hover focus:shadow-none focus:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 图标-only 工具按钮：secondary 形，32px 方块（刷新等） */
export const CONTROL_BTN_ICON =
  "inline-flex h-8 w-8 min-h-[32px] shrink-0 items-center justify-center rounded-sm border border-notion-border bg-notion-bg text-notion-text-muted shadow-none ring-0 transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-notion-text/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 多行文本输入：与 text-input 同语义，高度自适应、允许纵向 resize */
export const CONTROL_TEXTAREA =
  "block w-full resize-y rounded-sm border border-notion-border bg-notion-bg px-3 py-2 font-sans text-sm font-normal leading-snug text-notion-text shadow-none ring-0 outline-none transition-colors placeholder:text-notion-text-light focus:border-zen-saffron focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-zen-saffron/25 disabled:cursor-not-allowed disabled:opacity-40";

/** 工具栏内联 select：与 CONTROL_SELECT 同观感，宽度随内容 */
export const CONTROL_SELECT_INLINE =
  "h-8 min-h-[32px] cursor-pointer rounded-sm border border-notion-border bg-notion-bg py-0 pl-3 pr-9 font-sans text-sm font-medium text-notion-text-muted shadow-none ring-0 transition-colors hover:border-notion-text-light hover:bg-notion-sidebar focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 disabled:opacity-40";

/** 环境页紧凑工具按钮（诊断 / 缓存 / 侧车等） */
export const ENV_COMPACT_BTN =
  "inline-flex items-center gap-1.5 rounded-sm border border-notion-border bg-notion-bg px-2.5 py-1 font-sans text-[12px] font-medium leading-[1.4] text-notion-text shadow-none transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-40";

/** 环境页 mono 技术输入（基于 CONTROL_TEXT_INPUT） */
export const ENV_MONO_FIELD =
  "block w-full font-mono text-[12px] leading-[1.4] text-notion-text placeholder:text-notion-text-light";

/** LLM 模式状态切换：居中行 */
export const ENV_SEGMENTED_ROW = "flex w-full justify-center";

/** LLM 模式状态切换轨道（Stitch：secondary-container 底 + 选中项白底） */
export const ENV_LLM_MODE_TOGGLE_TRACK =
  "inline-flex gap-0 rounded-lg bg-secondary-container p-1";

/** @deprecated 使用 ENV_LLM_MODE_TOGGLE_TRACK */
export const ENV_SEGMENTED_TRACK = ENV_LLM_MODE_TOGGLE_TRACK;

const ENV_LLM_MODE_TOGGLE_BTN_BASE =
  "min-w-[7.5rem] rounded-md border-0 px-4 py-1.5 text-center font-sans text-[13px] font-medium whitespace-nowrap shadow-none ring-0 appearance-none transition-[color,background-color,box-shadow] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40";

/** 状态切换项：选中 = 白底 + shadow + primary 字色；未选 = 透明底 + on-surface-variant */
export function envLlmModeToggleBtnClass(selected: boolean): string {
  return selected
    ? `${ENV_LLM_MODE_TOGGLE_BTN_BASE} bg-notion-bg text-zen-saffron-mid shadow-[0_1px_2px_rgba(0,0,0,0.06)]`
    : `${ENV_LLM_MODE_TOGGLE_BTN_BASE} bg-transparent text-notion-text-variant hover:text-notion-text`;
}

/** @deprecated 使用 envLlmModeToggleBtnClass */
export function envSegmentedBtnClass(active: boolean): string {
  return envLlmModeToggleBtnClass(active);
}
