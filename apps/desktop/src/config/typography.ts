export const PANEL_TYPOGRAPHY = {
  dialogTitle: "m-0 font-sans text-sm font-semibold leading-[1.4] text-notion-text",
  /** compactDialog 正文（与环境页 body 同为 12px） */
  dialogBody: "font-sans text-[12px] leading-relaxed text-notion-text-muted",
  /** compactDialog 正文强调 / 预览主文 */
  dialogText: "font-sans text-[12px] leading-relaxed text-notion-text",
  navLabel: "text-[12px] font-semibold leading-[1.4] text-notion-text",
  navDescription: "pl-[26px] text-[11px] leading-[1.4] text-notion-text-muted",
  /** 12px 折叠摘要：较 14px 区块标题降一级字重与对比度。 */
  envCollapsibleSummary: "text-[12px] font-medium leading-[1.4] text-notion-text-muted",
  sectionTitle: "m-0 text-[12px] font-semibold leading-[1.4] text-notion-text",
  sectionDescription: "m-0 mt-1 text-[12px] leading-[1.4] text-notion-text-muted",
  /** 环境与 LLM 面板页标题 / 副标题 / 表单标签（Stitch 定稿，标题较 display-md 略小） */
  envPageTitle: "m-0 text-[24px] font-semibold leading-tight tracking-tight text-notion-text",
  envPageSubtitle: "m-0 text-[14px] leading-relaxed text-notion-text-muted",
  /** 环境页内区块标题（本机 ASR 等长页） */
  envSectionTitle: "m-0 text-[14px] font-semibold leading-snug text-notion-text",
  envFieldLabel: "text-[11px] font-semibold uppercase tracking-wider text-notion-text-muted",
  envStatusBannerTitle: "text-[13px] font-semibold leading-snug",
  body: "text-[12px] leading-relaxed text-notion-text-muted",
  fieldLabel: "text-[11px] font-medium leading-[1.6] text-notion-text",
  controlText: "text-[12px] leading-[1.4] text-notion-text",
  /** 快捷键组合（sans，避免 mono 与 ⌘/中文混排时英文字形异常） */
  shortcutKeys: "font-sans text-[12px] font-medium leading-snug text-notion-text",
  helper: "text-[12px] leading-relaxed text-notion-text-muted",
  meta: "text-[11px] leading-[1.4] text-notion-text-muted",
  code: "font-mono text-[12px] leading-[1.4] text-zen-indigo",
  button: "text-[12px] font-medium leading-[1.4]",
  buttonSmall: "text-[11px] font-semibold leading-[1.4]",
  badge: "text-[11px] font-semibold uppercase tracking-[0.1em]",
} as const;

export const PANEL_CONTROL_TYPOGRAPHY = {
  compactInput: "font-sans text-[12px] leading-[1.4] text-notion-text placeholder:text-notion-text-light",
  compactTechnicalInput: "font-mono text-[12px] leading-[1.4] text-notion-text placeholder:text-notion-text-light",
} as const;

/** 居中 overlay 确认框 — 用 stack + actionRow，避免 mt-2 + mt-5 叠加 */
export const COMPACT_DIALOG_LAYOUT = {
  card: "w-[min(420px,calc(100vw-32px))] rounded-lg border border-notion-divider bg-notion-bg p-4 font-sans antialiased shadow-2xl",
  cardWide: "w-[min(512px,calc(100vw-32px))] rounded-lg border border-notion-divider bg-notion-bg p-4 font-sans antialiased shadow-2xl",
  stack: "flex flex-col gap-3",
  title: PANEL_TYPOGRAPHY.dialogTitle,
  actionRow: "flex flex-wrap items-center justify-end gap-2 pt-1",
  actionRowSplit: "flex flex-wrap items-center justify-between gap-2 pt-1",
} as const;
