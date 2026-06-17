import { Plus, RefreshCw, Search } from "lucide-react";
import {
  CONTROL_BTN_COMPACT_SECONDARY,
  CONTROL_BTN_ICON,
  CONTROL_BTN_PRIMARY,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { CorrectionMemoryBatchBar } from "./CorrectionMemoryBatchBar";
import { CorrectionMemoryConflictBanner } from "./CorrectionMemoryConflictBanner";
import { CorrectionMemoryEditor } from "./CorrectionMemoryEditor";
import { CorrectionMemoryTable } from "./CorrectionMemoryTable";
import { GlossaryListEditHint } from "./GlossaryListEditHint";
import { GlossarySortSelect } from "./glossarySortSelect";
import {
  GLOSSARY_EMPTY_TEXT,
  GLOSSARY_ERROR_TEXT,
  GLOSSARY_MASTER_DETAIL_GRID,
  GLOSSARY_MASTER_PANE,
} from "./glossaryPanelStyles";
import { GlossaryBottomSheet } from "./GlossaryBottomSheet";
import { GlossaryInspectorPanel } from "./GlossaryInspectorPanel";

type Props = Pick<
  GlossaryPageController,
  | "mem"
  | "disabled"
  | "memoryHeaderCheckboxRef"
  | "memEditorOpen"
  | "openMemEditor"
  | "closeMemEditor"
  | "handleSelectMemoryRow"
  | "memoryConflicts"
> & {
  compact?: boolean;
};

export function GlossaryCorrectionMemorySection({
  mem,
  disabled,
  compact = false,
  memoryHeaderCheckboxRef,
  memEditorOpen,
  openMemEditor,
  closeMemEditor,
  handleSelectMemoryRow,
  memoryConflicts,
}: Props) {
  const inspectorTitle = mem.editorMode === "edit" ? "编辑记忆" : "新建记忆";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 border-b border-notion-divider bg-notion-callout-bg px-4 py-2">
        <p className={`m-0 ${PANEL_TYPOGRAPHY.body} text-notion-text`}>
          {mem.rows.length} 条纠错记忆 · {mem.stableCount} 条已稳定
          {memoryConflicts.length > 0 ? ` · ${memoryConflicts.length} 组冲突待处理` : ""}
        </p>
        <p className={`m-0 mt-0.5 ${PANEL_TYPOGRAPHY.meta}`}>
          仅选区右键「纳入更正记忆」可新增词对；错形不会进入转写热词。
        </p>
      </div>

      <CorrectionMemoryConflictBanner groups={memoryConflicts} />

      <div
        className={
          memEditorOpen && !compact
            ? GLOSSARY_MASTER_DETAIL_GRID
            : "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        }
      >
        <div
          className={
            memEditorOpen && !compact
              ? GLOSSARY_MASTER_PANE
              : `${GLOSSARY_MASTER_PANE} flex-1 border-r-0`
          }
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-notion-divider bg-notion-sidebar px-4 py-2">
            <GlossarySortSelect
              value={mem.sortMode}
              disabled={disabled}
              onChange={mem.setSortMode}
            />
            <label className="relative flex w-48 items-center">
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
                className={`${CONTROL_TEXT_INPUT} pl-8`}
                aria-label="搜索纠错记忆"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={CONTROL_BTN_ICON}
                disabled={disabled}
                onClick={() => void mem.refresh()}
                aria-label="刷新纠错记忆列表"
              >
                <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </button>
              <button
                type="button"
                className={`${CONTROL_BTN_PRIMARY} gap-1.5`}
                disabled={disabled}
                onClick={openMemEditor}
              >
                <Plus className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                新建记忆
              </button>
            </div>
          </div>

          {mem.statusMessage ? (
            <p className={`m-0 shrink-0 px-4 py-1.5 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>
              {mem.statusMessage}
            </p>
          ) : null}
          {mem.loadError ? <p className={`mx-4 mt-2 shrink-0 ${GLOSSARY_ERROR_TEXT}`}>{mem.loadError}</p> : null}

          <div className="min-h-0 flex-1 overflow-auto">
            {mem.rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
                <p className="m-0 text-sm text-notion-text-muted">
                  暂无纠错记忆。在编辑器中手改并保存，或使用「新建记忆」手动添加。
                </p>
                <button type="button" className={CONTROL_BTN_PRIMARY} disabled={disabled} onClick={openMemEditor}>
                  新建记忆
                </button>
              </div>
            ) : mem.filteredRows.length === 0 ? (
              <p className={`m-4 ${GLOSSARY_EMPTY_TEXT}`}>没有匹配的纠错记忆。</p>
            ) : (
              <>
                {mem.filteredRows.length > 0 && mem.rows.length > mem.filteredRows.length ? (
                  <div className="flex flex-wrap items-center gap-2 px-4 py-2">
                    <button
                      type="button"
                      className={CONTROL_BTN_COMPACT_SECONDARY}
                      disabled={disabled}
                      onClick={mem.selectFiltered}
                    >
                      全选筛选结果（{mem.filteredRows.length}）
                    </button>
                  </div>
                ) : null}
                <div className="px-2 pb-2">
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
                </div>
                <CorrectionMemoryTable
                  rows={mem.filteredRows}
                  selectedKey={mem.selectedKey}
                  checkedKeys={mem.checkedKeys}
                  disabled={disabled}
                  compact={compact}
                  isAllVisibleSelected={mem.isAllVisibleSelected}
                  headerCheckboxRef={memoryHeaderCheckboxRef}
                  onToggleVisibleSelection={mem.toggleVisibleSelection}
                  onToggleChecked={mem.toggleChecked}
                  onSelect={handleSelectMemoryRow}
                />
              </>
            )}
          </div>
          {!memEditorOpen && mem.rows.length > 0 && mem.filteredRows.length > 0 ? (
            <GlossaryListEditHint>点击记忆编辑；或点「新建记忆」添加。</GlossaryListEditHint>
          ) : null}
        </div>

        {memEditorOpen && !compact ? (
          <GlossaryInspectorPanel title={inspectorTitle} onClose={closeMemEditor}>
            <CorrectionMemoryEditor
              mode={mem.editorMode}
              draft={mem.draft}
              disabled={disabled}
              onChange={mem.updateDraftField}
              onSave={() => void mem.saveDraft()}
              onReset={closeMemEditor}
              onDelete={
                mem.selectedKey
                  ? () => {
                      const key = mem.selectedKey;
                      if (key) void mem.removeRow(key);
                      closeMemEditor();
                    }
                  : undefined
              }
            />
          </GlossaryInspectorPanel>
        ) : null}
      </div>

      {memEditorOpen && compact ? (
        <GlossaryBottomSheet title={inspectorTitle} onClose={closeMemEditor}>
          <CorrectionMemoryEditor
            mode={mem.editorMode}
            draft={mem.draft}
            disabled={disabled}
            onChange={mem.updateDraftField}
            onSave={() => void mem.saveDraft()}
            onReset={closeMemEditor}
            onDelete={
              mem.selectedKey
                ? () => {
                    const key = mem.selectedKey;
                    if (key) void mem.removeRow(key);
                    closeMemEditor();
                  }
                : undefined
            }
          />
        </GlossaryBottomSheet>
      ) : null}
    </div>
  );
}
