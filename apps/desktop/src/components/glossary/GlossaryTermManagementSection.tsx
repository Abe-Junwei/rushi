import { Plus, RefreshCw, Search } from "lucide-react";
import {
  CONTROL_BTN_COMPACT_SECONDARY,
  CONTROL_BTN_ICON,
  CONTROL_BTN_PRIMARY,
  CONTROL_SELECT_INLINE,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { GLOSSARY_LIST_DISPLAY_CAP } from "../../pages/glossaryListCap";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GlossaryBatchBar } from "./GlossaryBatchBar";
import { GlossaryHotwordsStickySummary } from "./GlossaryHotwordsStickySummary";
import { GlossaryBottomSheet } from "./GlossaryBottomSheet";
import { GlossaryInspectorPanel } from "./GlossaryInspectorPanel";
import { GlossaryMineSection } from "./GlossaryMineSection";
import {
  GLOSSARY_EMPTY_TEXT,
  GLOSSARY_ERROR_TEXT,
  GLOSSARY_MASTER_DETAIL_GRID,
  GLOSSARY_MASTER_PANE,
} from "./glossaryPanelStyles";
import { GlossaryListEditHint } from "./GlossaryListEditHint";
import { GlossarySortSelect } from "./glossarySortSelect";
import { GlossaryTermEditor } from "./GlossaryTermEditor";
import { GlossaryTermTable } from "./GlossaryTermTable";
import { GlossaryToolbarOverflowMenu } from "./GlossaryToolbarOverflowMenu";

type Props = Pick<
  GlossaryPageController,
  | "g"
  | "disabled"
  | "headerCheckboxRef"
  | "termEditorOpen"
  | "openTermEditor"
  | "closeTermEditor"
  | "openBulkAddDialog"
  | "handleSelectTerm"
  | "handleDeleteFromEditor"
  | "mine"
> & {
  compact?: boolean;
};

export function GlossaryTermManagementSection({
  g,
  disabled,
  compact = false,
  headerCheckboxRef,
  termEditorOpen,
  openTermEditor,
  closeTermEditor,
  openBulkAddDialog,
  handleSelectTerm,
  handleDeleteFromEditor,
  mine,
}: Props) {
  const inspectorTitle = g.editorMode === "edit" ? "编辑词条" : "新建词条";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <GlossaryHotwordsStickySummary g={g} />

      <GlossaryMineSection mine={mine} disabled={disabled} variant="banner" />

      <div
        className={
          termEditorOpen && !compact
            ? GLOSSARY_MASTER_DETAIL_GRID
            : "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        }
      >
        <div
          className={
            termEditorOpen && !compact
              ? GLOSSARY_MASTER_PANE
              : `${GLOSSARY_MASTER_PANE} flex-1 border-r-0`
          }
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-notion-divider bg-notion-sidebar px-4 py-2">
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
              <GlossarySortSelect
                value={g.sortMode}
                disabled={disabled}
                onChange={g.setSortMode}
              />
              <label className="relative flex w-48 items-center">
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
                className={CONTROL_BTN_ICON}
                disabled={disabled}
                onClick={() => void g.refresh()}
                aria-label="刷新术语列表"
              >
                <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GlossaryToolbarOverflowMenu
                disabled={disabled}
                exportDisabled={g.terms.length === 0}
                onBulkAdd={openBulkAddDialog}
                onImportFromFile={() => void g.importFromFile()}
                onExportCsv={() => void g.exportCsv()}
              />
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

          {g.statusMessage ? (
            <p className={`m-0 shrink-0 px-4 py-1.5 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{g.statusMessage}</p>
          ) : null}
          {g.error ? <p className={`mx-4 mt-2 shrink-0 ${GLOSSARY_ERROR_TEXT}`}>{g.error}</p> : null}

          <div className="min-h-0 flex-1 overflow-auto">
            {g.terms.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
                <p className="m-0 text-sm text-notion-text-muted">
                  转写词汇表为空。添加希望听成的专名/术语，并勾选「纳入下次转写（热词）」。
                </p>
                <button type="button" className={CONTROL_BTN_PRIMARY} disabled={disabled} onClick={openTermEditor}>
                  添加词条
                </button>
              </div>
            ) : g.filteredTerms.length === 0 ? (
              <p className={`m-4 ${GLOSSARY_EMPTY_TEXT}`}>没有匹配的术语。</p>
            ) : (
              <>
                {g.filteredTerms.length > GLOSSARY_LIST_DISPLAY_CAP ? (
                  <div className="flex flex-wrap items-center gap-2 px-4 py-2">
                    <p className={`m-0 flex-1 ${PANEL_TYPOGRAPHY.meta}`}>
                      匹配 {g.filteredTerms.length} 条，列表仅显示前 {GLOSSARY_LIST_DISPLAY_CAP} 条。
                    </p>
                    <button
                      type="button"
                      className={CONTROL_BTN_COMPACT_SECONDARY}
                      disabled={disabled}
                      onClick={g.selectFiltered}
                    >
                      全选筛选结果（{g.filteredTerms.length}）
                    </button>
                  </div>
                ) : null}
                <div className="px-2 pb-2">
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
                </div>
                <GlossaryTermTable
                  rows={g.visibleTerms}
                  selectedId={g.selectedId}
                  checkedIds={g.checkedIds}
                  disabled={disabled}
                  compact={compact}
                  isAllVisibleSelected={g.isAllVisibleSelected}
                  headerCheckboxRef={headerCheckboxRef}
                  onToggleVisibleSelection={g.toggleVisibleSelection}
                  onToggleChecked={g.toggleChecked}
                  onSelectTerm={handleSelectTerm}
                  onToggleRowHotword={(row) => void g.toggleRowHotword(row)}
                />
              </>
            )}
          </div>
          {!termEditorOpen && g.terms.length > 0 && g.filteredTerms.length > 0 ? (
            <GlossaryListEditHint>点击词条编辑；或点「添加词条」新建。</GlossaryListEditHint>
          ) : null}
        </div>

        {termEditorOpen && !compact ? (
          <GlossaryInspectorPanel title={inspectorTitle} onClose={closeTermEditor}>
            <GlossaryTermEditor
              mode={g.editorMode}
              draft={g.draft}
              disabled={disabled}
              onChange={g.updateDraftField}
              onSave={() => void g.saveDraft()}
              onReset={closeTermEditor}
              onDelete={g.editorMode === "edit" ? handleDeleteFromEditor : undefined}
            />
          </GlossaryInspectorPanel>
        ) : null}
      </div>

      {termEditorOpen && compact ? (
        <GlossaryBottomSheet title={inspectorTitle} onClose={closeTermEditor}>
          <GlossaryTermEditor
            mode={g.editorMode}
            draft={g.draft}
            disabled={disabled}
            onChange={g.updateDraftField}
            onSave={() => void g.saveDraft()}
            onReset={closeTermEditor}
            onDelete={g.editorMode === "edit" ? handleDeleteFromEditor : undefined}
          />
        </GlossaryBottomSheet>
      ) : null}
    </div>
  );
}
