import { Download, FileSpreadsheet, Plus, RefreshCw, Search } from "lucide-react";
import {
  CONTROL_BTN_ICON,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_SELECT_INLINE,
  CONTROL_TEXTAREA,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { GLOSSARY_LIST_DISPLAY_CAP } from "../../pages/glossaryListCap";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import {
  ENV_COLLAPSIBLE_DETAILS,
  EnvCollapsibleSectionSummary,
} from "../envLocalAsr/envLocalAsrPanelUi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GlossaryBatchBar } from "./GlossaryBatchBar";
import { GLOSSARY_EMPTY_TEXT, GLOSSARY_ERROR_TEXT } from "./glossaryPanelStyles";
import { GlossaryTermEditor } from "./GlossaryTermEditor";
import { GlossaryTermTable } from "./GlossaryTermTable";

type Props = Pick<
  GlossaryPageController,
  | "g"
  | "disabled"
  | "deleteConfirmId"
  | "headerCheckboxRef"
  | "termEditorRef"
  | "termEditorOpen"
  | "openTermEditor"
  | "closeTermEditor"
  | "handleSelectTerm"
  | "handleDeleteFromEditor"
  | "handleRowDelete"
>;

export function GlossaryTermManagementSection({
  g,
  disabled,
  deleteConfirmId,
  headerCheckboxRef,
  termEditorRef,
  termEditorOpen,
  openTermEditor,
  closeTermEditor,
  handleSelectTerm,
  handleDeleteFromEditor,
  handleRowDelete,
}: Props) {
  return (
    <section className="flex min-h-0 flex-col gap-4" aria-labelledby="glossary-terms-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 id="glossary-terms-heading" className={PANEL_TYPOGRAPHY.envSectionTitle}>
            转写词汇表
          </h2>
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
            className={CONTROL_SELECT_INLINE}
          >
            <option value="all">全部词条</option>
            <option value="enabled">仅已纳入热词</option>
            <option value="disabled">仅未纳入热词</option>
          </select>
          <label className="relative flex w-56 items-center">
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
              className={`${CONTROL_TEXT_INPUT} pl-8`}
              aria-label="搜索术语"
            />
          </label>
          <button
            type="button"
            className={`${CONTROL_BTN_SECONDARY} gap-1.5`}
            disabled={disabled || g.terms.length === 0}
            onClick={() => void g.exportCsv()}
          >
            <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            导出 CSV
          </button>
          <button
            type="button"
            className={CONTROL_BTN_ICON}
            disabled={disabled}
            onClick={() => void g.refresh()}
            aria-label="刷新术语列表"
          >
            <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
          <button
            type="button"
            className={`${CONTROL_BTN_PRIMARY} gap-1.5`}
            disabled={disabled}
            onClick={openTermEditor}
          >
            <Plus className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            添加词条
          </button>
        </div>
      </div>

      {termEditorOpen ? (
        <div ref={termEditorRef}>
          <GlossaryTermEditor
            mode={g.editorMode}
            draft={g.draft}
            disabled={disabled}
            onChange={g.updateDraftField}
            onSave={() => void g.saveDraft()}
            onReset={closeTermEditor}
            onDelete={g.editorMode === "edit" ? handleDeleteFromEditor : undefined}
          />
        </div>
      ) : null}

      <details className={ENV_COLLAPSIBLE_DETAILS}>
        <EnvCollapsibleSectionSummary title="批量添加" />
        <div className="flex flex-col gap-2 pl-5 pt-2">
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
            className={`${CONTROL_TEXTAREA} min-h-[72px]`}
            aria-label="批量粘贴术语"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={CONTROL_BTN_PRIMARY}
              disabled={disabled || !g.bulkPaste.trim()}
              onClick={() => void g.bulkAdd()}
            >
              批量添加
            </button>
            <button
              type="button"
              className={`${CONTROL_BTN_SECONDARY} gap-1.5`}
              disabled={disabled}
              onClick={() => void g.importFromFile()}
            >
              <FileSpreadsheet className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              从表格导入…
            </button>
          </div>
        </div>
      </details>

      {g.statusMessage ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{g.statusMessage}</p>
      ) : null}
      {g.error ? <p className={GLOSSARY_ERROR_TEXT}>{g.error}</p> : null}

      {g.terms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-notion-divider px-4 py-10 text-center">
          <p className="m-0 text-sm text-notion-text-muted">
            转写词汇表为空。添加希望听成的专名/术语，并勾选「纳入下次转写（热词）」。
          </p>
          <button type="button" className={CONTROL_BTN_PRIMARY} disabled={disabled} onClick={openTermEditor}>
            添加词条
          </button>
        </div>
      ) : g.filteredTerms.length === 0 ? (
        <p className={GLOSSARY_EMPTY_TEXT}>没有匹配的术语。</p>
      ) : (
        <>
          {g.filteredTerms.length > GLOSSARY_LIST_DISPLAY_CAP ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className={`m-0 flex-1 ${PANEL_TYPOGRAPHY.meta} rounded-md bg-notion-callout-bg px-3 py-2`}>
                匹配 {g.filteredTerms.length} 条，列表仅显示前 {GLOSSARY_LIST_DISPLAY_CAP} 条。
              </p>
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-sm border border-notion-border bg-notion-bg px-2.5 text-[11px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
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
            onSelectTerm={handleSelectTerm}
            onToggleRowHotword={(row) => void g.toggleRowHotword(row)}
            onRowDelete={handleRowDelete}
          />
        </>
      )}

      <p className={PANEL_TYPOGRAPHY.helper}>
        点击行可打开编辑；勾选后可批量删除或设置「纳入下次转写（热词）」；搜索/筛选变更会清空选择。导出 CSV 与导入均支持 hotword_enabled 列。
      </p>
    </section>
  );
}
