import type { LlmOllamaTone } from "./llmEnvStatusTypes";

/** 顶栏芯片：就绪=绿，未就绪=红（与 ASR 就绪一致） */
export const LLM_STATUS_DOT_CLASS: Record<LlmOllamaTone, string> = {
  ok: "bg-zen-success",
  warn: "bg-zen-saffron",
  error: "bg-zen-cinnabar",
  idle: "bg-notion-divider",
};

export const LLM_STATUS_PANEL_CLASS: Record<LlmOllamaTone, string> = {
  ok: "bg-zen-success/10 text-notion-text",
  warn: "bg-zen-saffron/10 text-notion-text",
  error: "bg-zen-cinnabar/10 text-notion-text",
  idle: "bg-notion-sidebar-hover text-notion-text-muted",
};

/** 连体卡片 banner 标题色（Stitch F1） */
export const LLM_STATUS_BANNER_TITLE_CLASS: Record<LlmOllamaTone, string> = {
  ok: "text-zen-success",
  warn: "text-zen-saffron",
  error: "text-zen-cinnabar",
  idle: "text-notion-text-muted",
};

/** 状态 banner 刷新/探测按钮基类（无 Preflight 时须压平 UA 灰底） */
export const LLM_STATUS_REFRESH_BTN_BASE =
  "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-sm border border-transparent px-2 py-1 text-body font-medium shadow-none ring-0 appearance-none transition-[color,background-color,border-color] duration-150 ease-out enabled:hover:bg-notion-bg disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zen-saffron/35";

/** 状态 banner 右侧刷新/探测按钮（与圆点/标题语义色对齐；ok 用 action 绿区分 primary 绿） */
export const LLM_STATUS_REFRESH_BTN_CLASS: Record<LlmOllamaTone, string> = {
  ok: "text-zen-success-action enabled:hover:text-zen-success enabled:hover:border-zen-success-border/80",
  warn: "text-zen-saffron enabled:hover:text-zen-saffron-mid enabled:hover:border-zen-saffron-border/80",
  error: "text-zen-cinnabar enabled:hover:text-zen-cinnabar enabled:hover:border-zen-cinnabar-border/80",
  idle: "text-zen-saffron enabled:hover:text-zen-saffron-mid enabled:hover:border-zen-saffron-border/80",
};

/** 设置页能力状态条（本机 ASR / 在线 STT / LLM 共用；`LLM_*` 为历史别名） */
export const ENV_STATUS_DOT_CLASS = LLM_STATUS_DOT_CLASS;
export const ENV_STATUS_PANEL_CLASS = LLM_STATUS_PANEL_CLASS;
export const ENV_STATUS_BANNER_TITLE_CLASS = LLM_STATUS_BANNER_TITLE_CLASS;
export const ENV_STATUS_REFRESH_BTN_BASE = LLM_STATUS_REFRESH_BTN_BASE;
export const ENV_STATUS_REFRESH_BTN_CLASS = LLM_STATUS_REFRESH_BTN_CLASS;
