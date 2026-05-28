import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
} from "lucide-react";
import { GlossaryTermEditor } from "./glossary/GlossaryTermEditor";
import { GlossaryTermTable } from "./glossary/GlossaryTermTable";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import { GLOSSARY_LIST_DISPLAY_CAP } from "../pages/glossaryListCap";
import { useGlossaryController } from "../pages/useGlossaryController";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type GlossaryPageProps = {
  busy: boolean;
};

export function GlossaryPage({ busy }: GlossaryPageProps) {
  const g = useGlossaryController();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const disabled = busy || g.busy;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = g.isIndeterminate;
    }
  }, [g.isIndeterminate]);

  const handleDeleteFromEditor = useCallback(() => {
    if (g.selectedId == null) return;
    void g.remove(g.selectedId);
    setDeleteConfirmId(null);
  }, [g]);

  const handleRowDelete = useCallback(
    (id: number) => {
      if (deleteConfirmId !== id) {
        setDeleteConfirmId(id);
        return;
      }
      setDeleteConfirmId(null);
      void g.remove(id);
    },
    [deleteConfirmId, g],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg px-10 py-8"
      data-purpose="glossary-page"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-notion-divider pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zen-saffron/15 text-zen-saffron">
              <BookOpen className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </div>
            <div>
              <h1 className="m-0 text-[18px] font-semibold leading-[1.4] text-notion-text">术语库</h1>
              <p className={PANEL_TYPOGRAPHY.sectionDescription}>
                全局术语表：可手动指定哪些词条纳入 ASR 热词；领域与备注为词典模块预留字段。
              </p>
            </div>
          </div>
        </header>

        <section
          className="flex flex-col gap-2 rounded-xl border border-notion-divider bg-notion-callout-bg px-4 py-3"
          aria-labelledby="glossary-hotwords-heading"
        >
          <h2 id="glossary-hotwords-heading" className={PANEL_TYPOGRAPHY.sectionTitle}>
            本次转写将携带
          </h2>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{g.hotwordsSummary}</p>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            共 {g.terms.length} 条术语，{g.hotwordEnabledCount} 条已纳入热词
            {g.hotwordsPreview
              ? `；将提交 ${g.hotwordsPreview.termCount} 个唯一热词 token。`
              : "。"}
          </p>
          {g.hotwordsPreview?.truncated ? (
            <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-zen-saffron`}>
              全部热词 token 拼接约 {g.hotwordsPreview.joinedCharCount.toLocaleString()} 字符，超出上限；
              实际提交 {g.hotwordsPreview.includedTermCount} 个（约 {g.hotwordsPreview.submittedCharCount.toLocaleString()}{" "}
              字符），另有 {g.hotwordsPreview.droppedTermCount} 个未纳入。
            </p>
          ) : null}
          {g.hotwordsPreview?.preview ? (
            <pre className="m-0 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md bg-notion-bg/80 px-2 py-1.5 font-mono text-[11px] text-notion-text-muted">
              {g.hotwordsPreview.preview}
            </pre>
          ) : null}
        </section>

        <GlossaryTermEditor
          mode={g.editorMode}
          draft={g.draft}
          disabled={disabled}
          onChange={g.updateDraftField}
          onSave={() => void g.saveDraft()}
          onReset={g.resetEditor}
          onDelete={g.editorMode === "edit" ? handleDeleteFromEditor : undefined}
        />

        <section className="flex flex-col gap-3">
          <h2 className={PANEL_TYPOGRAPHY.sectionTitle}>批量添加</h2>
          <textarea
            value={g.bulkPaste}
            onChange={(e) => g.setBulkPaste(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void g.bulkAdd();
              }
            }}
            rows={3}
            placeholder="粘贴 Excel 选区（Tab 分列、换行分行）或逗号/顿号分隔；默认纳入热词"
            disabled={disabled}
            className={`min-h-[72px] w-full resize-y rounded-lg border border-notion-border bg-notion-bg px-3 py-2 outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-50 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
            aria-label="批量粘贴术语"
          />
          <div className="flex flex-wrap items-stretch gap-2">
            <button
              type="button"
              className="inline-flex min-h-[36px] items-center justify-center rounded-lg border-0 bg-zen-saffron px-4 text-sm font-semibold text-notion-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || !g.bulkPaste.trim()}
              onClick={() => void g.bulkAdd()}
            >
              批量添加
            </button>
            <button
              type="button"
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
              disabled={disabled}
              onClick={() => void g.importFromFile()}
            >
              <FileSpreadsheet className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              从表格导入…
            </button>
          </div>
        </section>

        {g.statusMessage ? (
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{g.statusMessage}</p>
        ) : null}
        {g.error ? (
          <p className="rounded-md border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
            {g.error}
          </p>
        ) : null}

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className={PANEL_TYPOGRAPHY.sectionTitle}>已收录术语</h2>
              <span className={PANEL_TYPOGRAPHY.meta}>
                {g.searchQuery.trim()
                  ? `${g.filteredTerms.length} / ${g.terms.length} 条`
                  : `${g.terms.length} 条`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={g.hotwordFilter}
                onChange={(e) => g.setHotwordFilter(e.target.value as typeof g.hotwordFilter)}
                disabled={disabled}
                aria-label="热词筛选"
                className={`min-h-[36px] rounded-lg border border-notion-border bg-notion-bg px-2 outline-none focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-50 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
              >
                <option value="all">全部词条</option>
                <option value="enabled">仅已纳入热词</option>
                <option value="disabled">仅未纳入热词</option>
              </select>
              <label className="relative flex min-w-[200px] flex-1 items-center">
                <Search
                  className={`pointer-events-none absolute left-2.5 ${LUCIDE_ICON_SIZE_SM} text-notion-text-muted`}
                  strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                  aria-hidden
                />
                <input
                  type="search"
                  value={g.searchQuery}
                  onChange={(e) => g.setSearchQuery(e.target.value)}
                  placeholder="搜索术语、别名、领域、备注"
                  disabled={disabled}
                  className={`min-h-[36px] w-full rounded-lg border border-notion-border bg-notion-bg py-2 pl-8 pr-3 outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-50 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
                  aria-label="搜索术语"
                />
              </label>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
                disabled={disabled || g.terms.length === 0}
                onClick={() => void g.exportCsv()}
              >
                <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                导出 CSV
              </button>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
                disabled={disabled}
                onClick={() => void g.refresh()}
                aria-label="刷新术语列表"
              >
                <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </button>
            </div>
          </div>

          {g.terms.length === 0 ? (
            <p className="rounded-xl border border-dashed border-notion-divider bg-notion-bg/80 px-4 py-10 text-center text-sm text-notion-text-muted">
              暂无术语。在上方新建词条，或使用批量添加 / 表格导入。
            </p>
          ) : g.filteredTerms.length === 0 ? (
            <p className="rounded-xl bg-notion-callout-bg px-4 py-8 text-center text-sm text-notion-text-muted">
              没有匹配的术语。
            </p>
          ) : (
            <>
              {g.filteredTerms.length > GLOSSARY_LIST_DISPLAY_CAP ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`m-0 flex-1 ${PANEL_TYPOGRAPHY.meta} rounded-md bg-notion-callout-bg px-3 py-2`}>
                    匹配 {g.filteredTerms.length} 条，列表仅显示前 {GLOSSARY_LIST_DISPLAY_CAP} 条。
                  </p>
                  <button
                    type="button"
                    className="min-h-[32px] rounded-md border border-notion-border bg-notion-bg px-2.5 text-[11px] font-medium text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
                    disabled={disabled}
                    onClick={g.selectFiltered}
                  >
                    全选筛选结果（{g.filteredTerms.length}）
                  </button>
                </div>
              ) : null}
              <GlossaryTermTable
                rows={g.visibleTerms}
                selectedId={g.selectedId}
                checkedIds={g.checkedIds}
                deleteConfirmId={deleteConfirmId}
                disabled={disabled}
                isAllVisibleSelected={g.isAllVisibleSelected}
                isIndeterminate={g.isIndeterminate}
                headerCheckboxRef={headerCheckboxRef}
                onToggleVisibleSelection={g.toggleVisibleSelection}
                onToggleChecked={g.toggleChecked}
                onSelectTerm={g.selectTerm}
                onToggleRowHotword={(row) => void g.toggleRowHotword(row)}
                onRowDelete={handleRowDelete}
              />
            </>
          )}
        </section>

        <p className={PANEL_TYPOGRAPHY.helper}>
          勾选后可批量删除或设置热词；搜索/筛选变更会清空选择。导出 CSV 与结构化导入均支持 hotword_enabled 列。
        </p>
      </div>
    </div>
  );
}
