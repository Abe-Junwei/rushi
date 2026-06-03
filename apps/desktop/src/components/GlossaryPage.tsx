import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { CorrectionMemoryBatchBar } from "./glossary/CorrectionMemoryBatchBar";
import { CorrectionMemoryEditor } from "./glossary/CorrectionMemoryEditor";
import { CorrectionMemoryTable } from "./glossary/CorrectionMemoryTable";
import { GlossaryBatchBar } from "./glossary/GlossaryBatchBar";
import { GlossaryTermEditor } from "./glossary/GlossaryTermEditor";
import { GlossaryTermTable } from "./glossary/GlossaryTermTable";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import { GLOSSARY_LIST_DISPLAY_CAP } from "../pages/glossaryListCap";
import { useCorrectionMemoryController } from "../pages/useCorrectionMemoryController";
import { useGlossaryController } from "../pages/useGlossaryController";
import { useGlossaryMineController } from "../pages/useGlossaryMineController";
import { useLexiconBundleController } from "../pages/useLexiconBundleController";
import { groupCorrectionMemoryConflicts } from "../services/correctionMemoryConflicts";
import { CorrectionMemoryConflictBanner } from "./glossary/CorrectionMemoryConflictBanner";
import { GlossaryMineSection } from "./glossary/GlossaryMineSection";
import { LexiconBundleImportDialog } from "./glossary/LexiconBundleImportDialog";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type GlossaryPageProps = {
  busy: boolean;
};

export function GlossaryPage({ busy }: GlossaryPageProps) {
  const g = useGlossaryController();
  const mem = useCorrectionMemoryController();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleStatus, setBundleStatus] = useState("");
  const [bundleError, setBundleError] = useState("");
  const mine = useGlossaryMineController({
    onGlossaryChanged: () => g.refresh(),
  });
  const lex = useLexiconBundleController({
    onImported: async () => {
      await Promise.all([g.refresh(), mem.refresh()]);
    },
    setError: setBundleError,
    setStatusMessage: setBundleStatus,
    setBusy: setBundleBusy,
  });
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const memoryHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const termEditorRef = useRef<HTMLDivElement>(null);
  const disabled = busy || g.busy || mem.busy || mine.busy || bundleBusy;

  const scrollToTermEditor = useCallback(() => {
    g.resetEditor();
    termEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [g]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = g.isIndeterminate;
    }
  }, [g.isIndeterminate]);

  useEffect(() => {
    if (memoryHeaderCheckboxRef.current) {
      memoryHeaderCheckboxRef.current.indeterminate = mem.isIndeterminate;
    }
  }, [mem.isIndeterminate]);

  const handleDeleteFromEditor = useCallback(() => {
    if (g.selectedId == null) return;
    void g.remove(g.selectedId);
    setDeleteConfirmId(null);
  }, [g]);

  const memoryConflicts = useMemo(() => groupCorrectionMemoryConflicts(mem.rows), [mem.rows]);

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
      data-purpose="hotwords-memory-page"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="flex flex-col gap-2 border-b border-notion-divider pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zen-saffron/15 text-zen-saffron">
              <BookOpen className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </div>
            <div>
              <h1 className="m-0 text-[18px] font-semibold leading-[1.4] text-notion-text">热词与记忆</h1>
              <p className={PANEL_TYPOGRAPHY.sectionDescription}>
                <strong className="font-medium text-notion-text">转写词汇表（Custom Vocabulary）</strong>
                ：只收录希望听成的正形，纳入热词后在下次 ASR 拉取时提交。
                <strong className="font-medium text-notion-text">纠错记忆</strong>
                ：错→对，用于改正建议与编辑内规则，错形不会进入转写热词。
              </p>
            </div>
          </div>
        </header>

        <section
          className="flex flex-col gap-2 rounded-md border border-notion-divider bg-notion-callout-bg px-4 py-3"
          aria-labelledby="glossary-hotwords-heading"
        >
          <h2 id="glossary-hotwords-heading" className={PANEL_TYPOGRAPHY.sectionTitle}>
            转写词汇表（Custom Vocabulary）
          </h2>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{g.hotwordsSummary}</p>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            共 {g.terms.length} 条词条，{g.hotwordEnabledCount} 条已勾选「纳入下次转写（热词）」
            {g.hotwordsPreview
              ? `；将提交 ${g.hotwordsPreview.termCount} 个唯一热词 token。`
              : "。"}
            本表影响<strong className="font-medium text-notion-text">下次听写</strong>；纠错记忆影响
            <strong className="font-medium text-notion-text">当前稿改正</strong>，二者勿混用。
          </p>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            本机 FunASR 使用空格串 <code className="font-mono text-[11px]">hotwords</code>；在线 STT 按厂商映射（见「环境与
            ASR → 在线 STT」）。
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

        <section
          className="flex flex-col gap-3 rounded-md bg-notion-callout-bg px-4 py-3"
          aria-labelledby="lexicon-bundle-heading"
        >
          <h2 id="lexicon-bundle-heading" className={PANEL_TYPOGRAPHY.sectionTitle}>
            词表包（小团队交换）
          </h2>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            导出/导入 <code className="font-mono text-[11px]">rushi_lexicon_bundle.v1.json</code>
            ，仅含术语表与稳定纠错记忆，不含语段正文。
          </p>
          <label className="flex items-center gap-2 text-sm text-notion-text">
            <input
              type="checkbox"
              checked={lex.exportStableOnly}
              onChange={(e) => lex.setExportStableOnly(e.target.checked)}
              disabled={disabled}
            />
            仅导出稳定记忆（hit≥2 或已采纳）
          </label>
          <label className="flex flex-col gap-1">
            <span className={PANEL_TYPOGRAPHY.meta}>来源标签（可选）</span>
            <input
              type="text"
              value={lex.exportLabel}
              onChange={(e) => lex.setExportLabel(e.target.value)}
              disabled={disabled}
              placeholder="例如：栏目 A / 用户 B"
              className={`min-h-[36px] rounded-lg border border-notion-border bg-notion-bg px-3 outline-none focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-50 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
              disabled={disabled}
              onClick={() => void lex.exportBundle()}
            >
              <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              导出词表包…
            </button>
            <button
              type="button"
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
              disabled={disabled}
              onClick={() => void lex.startImportPreview()}
            >
              <FileSpreadsheet className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              导入词表包…
            </button>
          </div>
          {bundleStatus ? <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{bundleStatus}</p> : null}
          {bundleError ? (
            <p className="m-0 rounded-md border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
              {bundleError}
            </p>
          ) : null}
        </section>

        {lex.pendingImport ? (
          <LexiconBundleImportDialog
            pending={lex.pendingImport}
            resolutions={lex.resolutions}
            disabled={disabled}
            onChoice={lex.setConflictChoice}
            onCancel={lex.cancelImport}
            onConfirm={() => void lex.confirmImportWithResolutions()}
          />
        ) : null}

        <GlossaryMineSection mine={mine} disabled={disabled} />

        <div ref={termEditorRef}>
        <GlossaryTermEditor
          mode={g.editorMode}
          draft={g.draft}
          disabled={disabled}
          onChange={g.updateDraftField}
          onSave={() => void g.saveDraft()}
          onReset={g.resetEditor}
          onDelete={g.editorMode === "edit" ? handleDeleteFromEditor : undefined}
        />
        </div>

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

        <section className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>已收录术语</h3>
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
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-notion-divider bg-notion-bg/80 px-4 py-10 text-center">
              <p className="m-0 text-sm text-notion-text-muted">
                转写词汇表为空。添加希望听成的专名/术语，并勾选「纳入下次转写（热词）」。
              </p>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border-0 bg-zen-saffron px-4 text-sm font-semibold text-notion-bg transition-opacity hover:opacity-90 disabled:opacity-40"
                disabled={disabled}
                onClick={scrollToTermEditor}
              >
                添加词条
              </button>
            </div>
          ) : g.filteredTerms.length === 0 ? (
            <p className="rounded-md bg-notion-callout-bg px-4 py-8 text-center text-sm text-notion-text-muted">
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
              <GlossaryBatchBar
                selectedCount={g.selectedCount}
                previewLabels={g.selectedPreviewLabels}
                hiddenSelectedCount={g.hiddenSelectedCount}
                disabled={disabled}
                deleteConfirm={g.batchDeleteConfirm}
                canEnableHotwords={g.canEnableHotwords}
                canDisableHotwords={g.canDisableHotwords}
                onEnableHotwords={() => void g.batchSetHotword(true)}
                onDisableHotwords={() => void g.batchSetHotword(false)}
                onDelete={() => void g.batchDelete()}
                onClearSelection={() => {
                  g.clearBatchDeleteConfirm();
                  g.clearSelection();
                }}
              />
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
          勾选后可批量删除或设置「纳入下次转写（热词）」；搜索/筛选变更会清空选择。导出 CSV 与导入均支持 hotword_enabled 列。
        </p>

        <div className="flex flex-col gap-2 border-t border-notion-divider pt-8">
          <div className="flex items-center gap-2">
            <Sparkles
              className={`${LUCIDE_ICON_SIZE_MD} text-zen-saffron`}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
            <h2 className={`m-0 ${PANEL_TYPOGRAPHY.sectionTitle}`}>纠错记忆</h2>
            <span className={PANEL_TYPOGRAPHY.meta}>
              {mem.rows.length} 条 · {mem.stableCount} 条稳定
            </span>
          </div>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            来自手改纳入、查找替换或本页新建。用于工具栏「纠错规则」与改正建议；正形可通过 F6 提示或右键纳入后加入上方转写词汇表（非自动进热词）。
          </p>
        </div>

        <CorrectionMemoryEditor
          mode={mem.editorMode}
          draft={mem.draft}
          disabled={disabled}
          onChange={mem.updateDraftField}
          onSave={() => void mem.saveDraft()}
          onReset={mem.resetEditor}
          onDelete={
            mem.selectedKey
              ? () => {
                  const key = mem.selectedKey;
                  if (key) void mem.removeRow(key);
                }
              : undefined
          }
        />

        {mem.statusMessage ? (
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{mem.statusMessage}</p>
        ) : null}
        {mem.loadError ? (
          <p className="rounded-md border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
            {mem.loadError}
          </p>
        ) : null}

        <CorrectionMemoryConflictBanner groups={memoryConflicts} />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>已收录记忆</h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex min-w-[200px] flex-1 items-center">
                <Search
                  className={`pointer-events-none absolute left-2.5 ${LUCIDE_ICON_SIZE_SM} text-notion-text-muted`}
                  strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                  aria-hidden
                />
                <input
                  type="search"
                  value={mem.searchQuery}
                  onChange={(e) => mem.setSearchQuery(e.target.value)}
                  placeholder="搜索错词、正词"
                  disabled={disabled}
                  className={`min-h-[36px] w-full rounded-lg border border-notion-border bg-notion-bg py-2 pl-8 pr-3 outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-50 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
                  aria-label="搜索纠错记忆"
                />
              </label>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
                disabled={disabled}
                onClick={() => void mem.refresh()}
                aria-label="刷新纠错记忆列表"
              >
                <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </button>
            </div>
          </div>

          {mem.rows.length === 0 ? (
            <p className="rounded-md bg-notion-callout-bg px-4 py-10 text-center text-sm text-notion-text-muted">
              暂无纠错记忆。在编辑器中手改并保存、使用查找替换全部替换，或于上方手动新建。
            </p>
          ) : mem.filteredRows.length === 0 ? (
            <p className="rounded-md bg-notion-callout-bg px-4 py-8 text-center text-sm text-notion-text-muted">
              没有匹配的纠错记忆。
            </p>
          ) : (
            <>
              {mem.filteredRows.length > 0 && mem.rows.length > mem.filteredRows.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="min-h-[32px] rounded-md border border-notion-border bg-notion-bg px-2.5 text-[11px] font-medium text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
                    disabled={disabled}
                    onClick={mem.selectFiltered}
                  >
                    全选筛选结果（{mem.filteredRows.length}）
                  </button>
                </div>
              ) : null}
              <CorrectionMemoryBatchBar
                selectedCount={mem.selectedCount}
                previewLabels={mem.previewLabels}
                hiddenSelectedCount={mem.hiddenSelectedCount}
                disabled={disabled}
                deleteConfirm={mem.batchDeleteConfirm}
                canAcceptRules={mem.canAcceptRules}
                onAcceptRules={() => void mem.batchAcceptRules()}
                onDelete={() => void mem.batchDelete()}
                onClearSelection={() => {
                  mem.clearBatchDeleteConfirm();
                  mem.clearSelection();
                }}
              />
              <CorrectionMemoryTable
                rows={mem.filteredRows}
                selectedKey={mem.selectedKey}
                checkedKeys={mem.checkedKeys}
                disabled={disabled}
                isAllVisibleSelected={mem.isAllVisibleSelected}
                isIndeterminate={mem.isIndeterminate}
                headerCheckboxRef={memoryHeaderCheckboxRef}
                onToggleVisibleSelection={mem.toggleVisibleSelection}
                onToggleChecked={mem.toggleChecked}
                onSelect={mem.selectRow}
                onAcceptRule={(row) => void mem.acceptAsRule(row)}
              />
            </>
          )}
        </section>

        <p className={PANEL_TYPOGRAPHY.helper}>
          勾选后可批量「采纳为规则」或删除；搜索变更会清空选择。列表最多 200 条。删除稳定规则后，F1 与转写提示将不再使用该对。
        </p>
      </div>
    </div>
  );
}
