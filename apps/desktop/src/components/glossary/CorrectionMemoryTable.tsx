import type { RefObject } from "react";
import { ListChecks } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  correctionMemoryRowKey,
  correctionMemoryStableLabel,
} from "../../services/correctionMemoryHelpers";
import type { CorrectionMemoryEntryRow } from "../../tauri/correctionApi";
import type { CorrectionMemoryKey } from "../../services/correctionMemoryHelpers";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import {
  GLOSSARY_CHECKBOX,
  GLOSSARY_TABLE,
  GLOSSARY_TABLE_HEAD_ROW,
  GLOSSARY_TABLE_TH,
  GLOSSARY_TABLE_WRAP,
  glossaryRowActionsClass,
  glossaryTableRowClass,
} from "./glossaryPanelStyles";

type Props = {
  rows: CorrectionMemoryEntryRow[];
  selectedKey: CorrectionMemoryKey | null;
  checkedKeys: Set<string>;
  disabled: boolean;
  isAllVisibleSelected: boolean;
  isIndeterminate: boolean;
  headerCheckboxRef: RefObject<HTMLInputElement | null>;
  onToggleVisibleSelection: () => void;
  onToggleChecked: (rowKey: string) => void;
  onSelect: (row: CorrectionMemoryEntryRow) => void;
  onAcceptRule: (row: CorrectionMemoryEntryRow) => void;
};

function isEditingKey(
  selected: CorrectionMemoryKey | null,
  row: CorrectionMemoryEntryRow,
): boolean {
  return selected?.wrong === row.wrong && selected?.right === row.right;
}

export function CorrectionMemoryTable({
  rows,
  selectedKey,
  checkedKeys,
  disabled,
  isAllVisibleSelected,
  isIndeterminate,
  headerCheckboxRef,
  onToggleVisibleSelection,
  onToggleChecked,
  onSelect,
  onAcceptRule,
}: Props) {
  return (
    <div className={GLOSSARY_TABLE_WRAP}>
      <table className={`${GLOSSARY_TABLE} min-w-[32rem]`}>
        <thead>
          <tr className={GLOSSARY_TABLE_HEAD_ROW}>
            <th className="w-10 px-2 py-2">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                className={GLOSSARY_CHECKBOX}
                checked={isAllVisibleSelected}
                disabled={disabled || rows.length === 0}
                aria-label="全选当前列表"
                onChange={onToggleVisibleSelection}
              />
            </th>
            <th className={GLOSSARY_TABLE_TH}>错词</th>
            <th className={GLOSSARY_TABLE_TH}>正词</th>
            <th className={`${GLOSSARY_TABLE_TH} tabular-nums`}>命中</th>
            <th className={GLOSSARY_TABLE_TH}>状态</th>
            <th className={`${GLOSSARY_TABLE_TH} text-right`}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = correctionMemoryRowKey(row);
            const active = isEditingKey(selectedKey, row);
            const checked = checkedKeys.has(rowId);
            return (
              <tr key={rowId} className={glossaryTableRowClass({ active, checked })}>
                <td className="px-2 py-2.5 align-top">
                  <input
                    type="checkbox"
                    className={`mt-0.5 ${GLOSSARY_CHECKBOX}`}
                    checked={checked}
                    disabled={disabled}
                    aria-label={`选择 ${row.wrong} → ${row.right}`}
                    onChange={() => onToggleChecked(rowId)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="w-full cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-notion-text"
                    disabled={disabled}
                    onClick={() => onSelect(row)}
                  >
                    {row.wrong}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-notion-text">{row.right}</td>
                <td className="px-3 py-2.5 tabular-nums text-notion-text-muted">{row.hitCount}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={[
                      "inline-block rounded px-1.5 py-0.5 text-[11px] font-medium",
                      row.isStable
                        ? "bg-zen-saffron/15 text-zen-saffron"
                        : "bg-notion-sidebar text-notion-text-muted",
                    ].join(" ")}
                  >
                    {correctionMemoryStableLabel(row)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {!row.acceptedAsRule ? (
                    <div className={glossaryRowActionsClass(false)}>
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-sm border-0 bg-transparent px-2 text-[11px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
                        disabled={disabled}
                        onClick={() => void onAcceptRule(row)}
                      >
                        <ListChecks
                          className={LUCIDE_ICON_SIZE_SM}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          aria-hidden
                        />
                        采纳
                      </button>
                    </div>
                  ) : (
                    <span className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-light`}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {isIndeterminate && headerCheckboxRef.current ? (
        <span className="sr-only" aria-live="polite">
          部分选中
        </span>
      ) : null}
    </div>
  );
}
