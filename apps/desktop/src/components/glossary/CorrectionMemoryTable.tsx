import type { RefObject } from "react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  correctionMemoryRowKey,
  correctionMemoryStableLabel,
} from "../../services/correctionMemoryHelpers";
import type { CorrectionMemoryEntryRow } from "../../tauri/correctionApi";
import type { CorrectionMemoryKey } from "../../services/correctionMemoryHelpers";
import { GlossaryListSelectBar } from "./GlossaryListSelectBar";
import {
  GLOSSARY_CHECKBOX,
  GLOSSARY_LIST_ROW_INNER,
  GLOSSARY_LIST_TRAILING_PILL,
  glossaryListRowClass,
} from "./glossaryPanelStyles";

type Props = {
  rows: CorrectionMemoryEntryRow[];
  selectedKey: CorrectionMemoryKey | null;
  checkedKeys: Set<string>;
  disabled: boolean;
  compact?: boolean;
  isAllVisibleSelected: boolean;
  headerCheckboxRef: RefObject<HTMLInputElement | null>;
  onToggleVisibleSelection: () => void;
  onToggleChecked: (rowKey: string) => void;
  onSelect: (row: CorrectionMemoryEntryRow) => void;
};

function isEditingKey(selected: CorrectionMemoryKey | null, row: CorrectionMemoryEntryRow): boolean {
  return selected?.wrong === row.wrong && selected?.right === row.right;
}

function stablePillClass(row: CorrectionMemoryEntryRow): string {
  return row.isStable || row.acceptedAsRule
    ? "bg-zen-saffron/15 text-zen-saffron"
    : "bg-notion-callout-bg text-notion-text-muted";
}

export function CorrectionMemoryTable({
  rows,
  selectedKey,
  checkedKeys,
  disabled,
  compact = false,
  isAllVisibleSelected,
  headerCheckboxRef,
  onToggleVisibleSelection,
  onToggleChecked,
  onSelect,
}: Props) {
  if (rows.length === 0) {
    return <p className={`m-0 px-4 py-8 text-center ${PANEL_TYPOGRAPHY.meta}`}>当前列表无纠错记忆。</p>;
  }

  const stableCount = rows.filter((r) => r.isStable || r.acceptedAsRule).length;

  return (
    <div className="flex flex-col">
      <GlossaryListSelectBar
        headerCheckboxRef={headerCheckboxRef}
        isAllVisibleSelected={isAllVisibleSelected}
        onToggleVisibleSelection={onToggleVisibleSelection}
        disabled={disabled}
        rowCount={rows.length}
        trailing={`${rows.length} 条 · ${stableCount} 条稳定`}
      />

      <ul className="m-0 list-none p-0" role="list" aria-label="纠错记忆">
        {rows.map((row) => {
          const rowId = correctionMemoryRowKey(row);
          const active = isEditingKey(selectedKey, row);
          const checked = checkedKeys.has(rowId);

          return (
            <li key={rowId} className={glossaryListRowClass({ active, checked })}>
              <div className={GLOSSARY_LIST_ROW_INNER}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleChecked(rowId)}
                  disabled={disabled}
                  aria-label={`选择 ${row.wrong} → ${row.right}`}
                  className={[
                    "mt-0.5 shrink-0",
                    GLOSSARY_CHECKBOX,
                    checked || active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  ].join(" ")}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                  disabled={disabled}
                  onClick={() => onSelect(row)}
                >
                  <span className="block truncate text-sm font-medium text-notion-text">
                    {row.wrong}
                    <span className="mx-1 font-normal text-notion-text-muted">→</span>
                    {row.right}
                  </span>
                  {!compact ? (
                    <span className={`mt-0.5 block ${PANEL_TYPOGRAPHY.meta}`}>命中 {row.hitCount} 次</span>
                  ) : null}
                </button>
                <span
                  className={[GLOSSARY_LIST_TRAILING_PILL, "mt-0.5", stablePillClass(row)].join(" ")}
                  aria-label={`状态：${correctionMemoryStableLabel(row)}`}
                >
                  {correctionMemoryStableLabel(row)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
