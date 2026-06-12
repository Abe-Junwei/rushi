/**
 * 热词与记忆页共享样式（表格 / 卡片 / 状态条）。
 * 对齐 DESIGN.md Notion Zen：白底卡 + 1px border、表格行操作 hover-reveal、saffron 选中态。
 */

/** 白底卡片（编辑表单等）：Cards 规范 = 白底 + 1px border + 6px 圆角 */
export const GLOSSARY_CARD = "rounded-md border border-notion-border bg-notion-bg";

/** 错误条（cinnabar 软底） */
export const GLOSSARY_ERROR_TEXT =
  "m-0 rounded-md border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar";

/** 居中空状态文本块 */
export const GLOSSARY_EMPTY_TEXT =
  "m-0 rounded-md bg-notion-callout-bg px-4 py-8 text-center text-sm text-notion-text-muted";

/** 表格外框（表格自身唯一一层 border） */
export const GLOSSARY_TABLE_WRAP = "overflow-x-auto rounded-md border border-notion-divider";

export const GLOSSARY_TABLE = "w-full border-collapse text-left text-[12px]";

export const GLOSSARY_TABLE_HEAD_ROW =
  "border-b border-notion-divider bg-notion-sidebar text-notion-text-muted";

export const GLOSSARY_TABLE_TH = "px-3 py-2 font-semibold";

/** 表格行：`group` 供行内操作 hover-reveal 使用 */
export function glossaryTableRowClass(opts: { active?: boolean; checked?: boolean }): string {
  return [
    "group border-b border-notion-divider/60 transition-colors last:border-b-0",
    opts.active
      ? "bg-zen-saffron/10"
      : opts.checked
        ? "bg-notion-callout-bg/80"
        : "bg-notion-bg hover:bg-notion-sidebar-hover/60",
  ].join(" ");
}

/** 行内操作容器：默认隐藏，hover / 键盘聚焦显现（DESIGN.md Lists 规范）；确认态强制常显 */
export function glossaryRowActionsClass(forceVisible: boolean): string {
  return [
    "flex items-center justify-end gap-1 transition-opacity",
    forceVisible
      ? "opacity-100"
      : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
  ].join(" ");
}

/** 行内删除按钮（含二次确认态）；批量条删除按钮同款 */
export function glossaryRowDeleteBtnClass(confirming: boolean): string {
  const base =
    "inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2.5 font-sans text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  return confirming
    ? `${base} border-zen-cinnabar bg-zen-cinnabar/10 text-zen-cinnabar`
    : `${base} border-notion-border bg-notion-bg text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text`;
}

/** 复选框（saffron 选中态） */
export const GLOSSARY_CHECKBOX =
  "h-4 w-4 rounded border-notion-border text-zen-saffron focus:ring-zen-saffron/30";
