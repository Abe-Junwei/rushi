import { RefreshCw, Search, Sparkles } from "lucide-react";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { CorrectionMemoryBatchBar } from "./CorrectionMemoryBatchBar";
import { CorrectionMemoryConflictBanner } from "./CorrectionMemoryConflictBanner";
import { CorrectionMemoryEditor } from "./CorrectionMemoryEditor";
import { CorrectionMemoryTable } from "./CorrectionMemoryTable";

type Props = Pick<
  GlossaryPageController,
  "mem" | "disabled" | "memoryHeaderCheckboxRef" | "memoryConflicts"
>;

export function GlossaryCorrectionMemorySection({
  mem,
  disabled,
  memoryHeaderCheckboxRef,
  memoryConflicts,
}: Props) {
  return (
    <>
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
          右键纳入后开始学习；之后每次保存（含自动保存）累计命中，满 3 次自动稳定并写入术语表。可在此查看、删除或批量「采纳为规则」。
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
    </>
  );
}
