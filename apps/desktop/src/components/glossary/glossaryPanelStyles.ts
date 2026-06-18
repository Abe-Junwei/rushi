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

/** 行内删除按钮（含二次确认态）；批量条删除按钮同款 */
export function glossaryRowDeleteBtnClass(confirming: boolean): string {
  const base =
    "inline-flex h-7 shrink-0 items-center gap-1 rounded-sm border px-2.5 font-sans text-label font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  return confirming
    ? `${base} border-zen-cinnabar bg-zen-cinnabar/10 text-zen-cinnabar`
    : `${base} border-notion-border bg-notion-bg text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text`;
}

/** 复选框（saffron 选中态） */
export const GLOSSARY_CHECKBOX =
  "h-4 w-4 rounded border-notion-border text-accent-action focus:ring-accent-action/30";

/** Master–Detail 右侧检视器壳（320px 固定，不随窗口拉伸） */
export const GLOSSARY_INSPECTOR_SHELL =
  "flex w-80 shrink-0 grow-0 basis-80 flex-col border-l border-notion-divider bg-notion-sidebar";

/** 列表 + 检视器：左列占满剩余，右列 20rem */
export const GLOSSARY_MASTER_DETAIL_GRID =
  "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] overflow-hidden";

/** Master 列表列 */
export const GLOSSARY_MASTER_PANE =
  "flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-notion-divider";

export const GLOSSARY_INSPECTOR_HEADER =
  "sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-notion-divider bg-notion-sidebar px-4 py-2.5";

/** Notion List 行：无竖线、仅底部分隔，hover / 选中底色 */
export function glossaryListRowClass(opts: { active?: boolean; checked?: boolean }): string {
  return [
    "group relative border-b border-notion-divider/60 transition-colors last:border-b-0",
    opts.active
      ? "bg-accent-action/10"
      : opts.checked
        ? "bg-notion-callout-bg/80"
        : "bg-notion-bg hover:bg-notion-sidebar-hover/60",
  ].join(" ");
}

/** List 视图顶栏：左全选、右计数（无表头列） */
export const GLOSSARY_LIST_SELECT_BAR =
  "sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-notion-divider/60 bg-notion-bg/95 px-4 py-1.5 backdrop-blur-xs";

/** List 行内层：leading 主内容 + trailing 元数据贴右 */
export const GLOSSARY_LIST_ROW_INNER =
  "flex min-h-10 items-start gap-2 px-4 py-2";

/** 行尾状态 pill（热词 / 稳定等） */
export const GLOSSARY_LIST_TRAILING_PILL =
  "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-label font-medium";

/** 列表底栏提示（检视器未打开时） */
export const GLOSSARY_LIST_EDIT_HINT =
  "shrink-0 border-t border-notion-divider/60 bg-notion-callout-bg/50 px-4 py-2 text-notion-text-muted";
