import { Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import {
  CONTROL_BTN_ICON,
  CONTROL_BTN_PRIMARY,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { CorrectionMemoryBatchBar } from "./CorrectionMemoryBatchBar";
import { CorrectionMemoryConflictBanner } from "./CorrectionMemoryConflictBanner";
import { CorrectionMemoryEditor } from "./CorrectionMemoryEditor";
import { CorrectionMemoryTable } from "./CorrectionMemoryTable";
import { GLOSSARY_EMPTY_TEXT, GLOSSARY_ERROR_TEXT } from "./glossaryPanelStyles";

type Props = Pick<
  GlossaryPageController,
  | "mem"
  | "disabled"
  | "memoryHeaderCheckboxRef"
  | "memoryEditorRef"
  | "memEditorOpen"
  | "openMemEditor"
  | "closeMemEditor"
  | "handleSelectMemoryRow"
  | "memoryConflicts"
>;

export function GlossaryCorrectionMemorySection({
  mem,
  disabled,
  memoryHeaderCheckboxRef,
  memoryEditorRef,
  memEditorOpen,
  openMemEditor,
  closeMemEditor,
  handleSelectMemoryRow,
  memoryConflicts,
}: Props) {
  return (
    <section
      className="flex min-h-0 flex-col gap-4 border-t border-notion-divider pt-8"
      aria-labelledby="correction-memory-heading"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center gap-2">
              <Sparkles
                className={`${LUCIDE_ICON_SIZE_MD} text-zen-saffron`}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
              <h2 id="correction-memory-heading" className={PANEL_TYPOGRAPHY.envSectionTitle}>
                纠错记忆
              </h2>
            </span>
            <span className={PANEL_TYPOGRAPHY.meta}>
              {mem.rows.length} 条 · {mem.stableCount} 条稳定
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex w-56 items-center">
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
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          仅选区右键「纳入更正记忆」可新增词对并开始学习；之后每次保存（含自动保存）仅对已纳入的错→对累计命中，满 3 次自动稳定并写入术语表。
        </p>
      </div>

      {memEditorOpen ? (
        <div ref={memoryEditorRef}>
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
                  }
                : undefined
            }
          />
        </div>
      ) : null}

      {mem.statusMessage ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{mem.statusMessage}</p>
      ) : null}
      {mem.loadError ? <p className={GLOSSARY_ERROR_TEXT}>{mem.loadError}</p> : null}

      <CorrectionMemoryConflictBanner groups={memoryConflicts} />

      {mem.rows.length === 0 ? (
        <p className={GLOSSARY_EMPTY_TEXT}>
          暂无纠错记忆。在编辑器中手改并保存、使用查找替换全部替换，或点击「新建记忆」手动添加。
        </p>
      ) : mem.filteredRows.length === 0 ? (
        <p className={GLOSSARY_EMPTY_TEXT}>没有匹配的纠错记忆。</p>
      ) : (
        <>
          {mem.filteredRows.length > 0 && mem.rows.length > mem.filteredRows.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-sm border border-notion-border bg-notion-bg px-2.5 text-[11px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
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
            onSelect={handleSelectMemoryRow}
            onAcceptRule={(row) => void mem.acceptAsRule(row)}
          />
        </>
      )}

      <p className={PANEL_TYPOGRAPHY.helper}>
        点击错词可打开编辑；勾选后可批量「采纳为规则」或删除；搜索变更会清空选择。列表最多 200 条。删除稳定规则后，F1 与转写提示将不再使用该对。
      </p>
    </section>
  );
}
