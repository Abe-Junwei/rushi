import type { LlmOllamaTone } from "./llmEnvStatusTypes";

/** 顶栏芯片：就绪=绿，未就绪=红（与 ASR 就绪一致） */
export const LLM_STATUS_DOT_CLASS: Record<LlmOllamaTone, string> = {
  ok: "bg-zen-success",
  warn: "bg-zen-saffron",
  error: "bg-zen-cinnabar",
  idle: "bg-notion-divider",
};

export const LLM_STATUS_PANEL_CLASS: Record<LlmOllamaTone, string> = {
  ok: "bg-zen-success-surface text-notion-text",
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
  "inline-flex shrink-0 items-center gap-1 rounded border-0 bg-transparent px-2 py-1 text-[12px] font-medium shadow-none ring-0 appearance-none transition-colors disabled:opacity-40";

/** 状态 banner 右侧刷新/探测按钮（ok 用 action 绿，与标题/圆点 primary 绿区分） */
export const LLM_STATUS_REFRESH_BTN_CLASS: Record<LlmOllamaTone, string> = {
  ok: "text-zen-success-action hover:bg-zen-success-border/80",
  warn: "text-zen-saffron hover:bg-zen-saffron/10",
  error: "text-notion-text-muted hover:bg-notion-sidebar-hover",
  idle: "text-notion-text-muted hover:bg-notion-sidebar-hover",
};
