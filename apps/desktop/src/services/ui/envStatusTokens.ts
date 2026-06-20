/** 顶栏三灯 / 设置能力状态条 — 固定语义色，不随「外观 → 主题色」变化。 */
export type EnvStatusTone = "ok" | "warn" | "error" | "idle";

export const ENV_STATUS_DOT_CLASS: Record<EnvStatusTone, string> = {
  ok: "bg-zen-success",
  warn: "bg-zen-status-warn",
  error: "bg-zen-cinnabar",
  idle: "bg-notion-divider",
};

export const ENV_STATUS_PANEL_CLASS: Record<EnvStatusTone, string> = {
  ok: "bg-zen-success/10 text-notion-text",
  warn: "bg-zen-status-warn/10 text-notion-text",
  error: "bg-zen-cinnabar/10 text-notion-text",
  idle: "bg-notion-sidebar-hover text-notion-text-muted",
};

export const ENV_STATUS_BANNER_TITLE_CLASS: Record<EnvStatusTone, string> = {
  ok: "text-zen-success",
  warn: "text-zen-status-warn",
  error: "text-zen-cinnabar",
  idle: "text-notion-text-muted",
};

export const ENV_STATUS_REFRESH_BTN_BASE =
  "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-sm border border-transparent px-2 py-1 text-body font-medium shadow-none ring-0 appearance-none transition-[color,background-color,border-color] duration-150 ease-out enabled:hover:bg-notion-bg disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-notion-text-light/40";

export const ENV_STATUS_REFRESH_BTN_CLASS: Record<EnvStatusTone, string> = {
  ok: "text-zen-success-action enabled:hover:text-zen-success enabled:hover:border-zen-success-border/80",
  warn: "text-zen-status-warn enabled:hover:text-zen-status-warn-action enabled:hover:border-zen-status-warn-border/80",
  error: "text-zen-cinnabar enabled:hover:text-zen-cinnabar enabled:hover:border-zen-cinnabar-border/80",
  idle: "text-notion-text-muted enabled:hover:text-notion-text enabled:hover:border-notion-divider/80",
};
