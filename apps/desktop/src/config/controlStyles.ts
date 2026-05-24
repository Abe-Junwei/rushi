/**
 * 项目坞控件 — 对齐仓库根 DESIGN.md Serene Scholar button / input 语义。
 * 旧 `CLAY_*` 导出名保留为兼容别名；圆角 12px = `rounded-xl`，高 44px，无常态阴影。
 */

/** `button-primary`：primary + on-primary，14px/600，44×，rounded.md */
export const CLAY_BTN_PRIMARY =
  "inline-flex h-11 min-h-[44px] items-center justify-center rounded-xl border border-transparent bg-zen-saffron px-5 font-sans text-sm font-semibold text-white shadow-none ring-0 transition-colors hover:bg-zen-saffron-mid focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40";

/** `button-secondary`：canvas + hairline + ink，14px/600 */
export const CLAY_BTN_SECONDARY =
  "inline-flex h-11 min-h-[44px] items-center justify-center rounded-xl border border-zen-gray-300 bg-app-bg px-5 font-sans text-sm font-semibold text-zen-ink shadow-none ring-0 transition-colors hover:border-zen-gray-400 hover:bg-zen-ochre focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-ink/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 在线 STT 入口：在 secondary 形之上用 saffron 发线强调实验能力 */
export const CLAY_BTN_ONLINE_STT =
  "inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-clay-pink/35 bg-app-bg px-5 font-sans text-sm font-semibold text-zen-ink shadow-none ring-0 transition-colors hover:border-clay-pink/55 hover:bg-clay-pink/10 focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-pink/35 disabled:cursor-not-allowed disabled:opacity-40";

/** 幽灵/第三态：canvas 底 + hairline，字色 muted */
export const CLAY_BTN_GHOST =
  "inline-flex h-11 min-h-[44px] items-center justify-center rounded-xl border border-zen-gray-300 bg-app-bg px-5 font-sans text-sm font-semibold text-app-text-muted shadow-none ring-0 transition-colors hover:bg-zen-ochre focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-ink/20 disabled:cursor-not-allowed disabled:opacity-40";

/** `text-input`：canvas + body-md + hairline；显式关 shadow/ring，避免与 workspace 或 WebKit 默认叠层 */
export const CLAY_TEXT_INPUT =
  "block w-full min-h-[44px] rounded-xl border border-zen-gray-300 bg-app-bg px-4 py-3 font-sans text-base font-normal leading-snug text-zen-ink shadow-none ring-0 outline-none transition-colors placeholder:text-zen-gray-400 focus:border-zen-ink focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-zen-ink/25 disabled:cursor-not-allowed disabled:opacity-40";

/** 与 text-input 同高同边，保留系统下拉箭头 */
export const CLAY_SELECT =
  "h-11 min-h-[44px] w-full min-w-[11rem] cursor-pointer rounded-xl border border-zen-gray-300 bg-app-bg py-0 pl-4 pr-10 font-sans text-sm font-medium text-app-text-muted shadow-none ring-0 transition-colors hover:border-zen-gray-400 hover:bg-zen-ochre focus:shadow-none focus:ring-0 focus-visible:shadow-none focus-visible:ring-0 disabled:opacity-40";
