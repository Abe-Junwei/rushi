/**
 * 自动转录 / 转写进度 — 文案排版真源。
 *
 * 规则（对齐 DESIGN.md 5 级字号 + Notion 对话框惯例）：
 * - 字号：仅 title 14 / body 12 / label 11 三档
 * - 字重：主句 semibold；区块小标题 medium；其余 regular
 * - label 11px 仅用于 meta（计时、链接），不用于区块标题
 */
const BASE = "m-0 font-sans";

export const TRANSCRIBE_PREFLIGHT_TYPO = {
  /** 对话框：块间距 12px */
  dialogStack: "flex flex-col gap-3",
  /** 对话框：块内 8px */
  dialogSection: "flex flex-col gap-2",
  sourceSwitchRow: "flex w-full justify-center",

  /** 12px — 说明 / 补充 */
  primary: `${BASE} text-title font-semibold leading-[1.4] text-notion-text`,
  /** 12px — 说明 / 补充 */
  body: `${BASE} text-body font-normal leading-[1.5] text-notion-text-muted`,
  /** 12px medium — 区块小标题（与正文同字号，更深色） */
  sectionTitle: `${BASE} text-body font-medium leading-[1.5] text-notion-text`,
  /** 12px — 警告（仅改色，不加粗） */
  warning: `${BASE} text-body font-normal leading-[1.5] text-zen-cinnabar`,
  /** 11px — meta（计时等） */
  caption: `${BASE} text-label font-normal leading-[1.4] text-notion-text-muted`,
  /** 11px — 文本链接 */
  link: `${BASE} text-label font-normal leading-[1.4] text-zen-saffron underline-offset-2 hover:underline`,

  /** 术语等次要区块：顶部分割线 + 上内边距 12px */
  sectionDivider: "border-t border-notion-divider pt-3",
  captionStack: "flex flex-col gap-1",

  /** 进度卡片外壳 */
  progressShell: "flex w-full flex-col items-center rounded-lg border text-center",
  progressShellCompact: "max-w-[288px] gap-3 px-4 py-4",
  progressShellDefault: "max-w-[320px] gap-4 px-5 py-5",
  /** 状态文案区：标题与副文 8px */
  progressCopy: "flex w-full flex-col gap-2",
  /** 14px — 卡片内唯一 semibold */
  progressPrimary: `${BASE} text-title font-semibold leading-[1.4] text-notion-text`,
  progressBody: `${BASE} text-body font-normal leading-[1.5] text-notion-text-muted`,
  progressSectionTitle: `${BASE} text-body font-medium leading-[1.5] text-notion-text`,
  progressCaption: `${BASE} text-label font-normal leading-[1.4] text-notion-text-muted`,
  /** 进度条 / 按钮区 */
  progressFooter: "flex w-full flex-col gap-2 border-t border-notion-divider pt-3",
  progressElapsed: `${BASE} font-mono text-label font-normal tabular-nums leading-[1.4] text-notion-text-muted`,
} as const;
