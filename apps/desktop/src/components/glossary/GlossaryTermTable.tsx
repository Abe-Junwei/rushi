import type { RefObject } from "react";
import { Flame, Trash2 } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryTermDto } from "../../tauri/glossaryApi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import {
  GLOSSARY_CHECKBOX,
  GLOSSARY_TABLE,
  GLOSSARY_TABLE_HEAD_ROW,
  GLOSSARY_TABLE_TH,
  GLOSSARY_TABLE_WRAP,
  glossaryRowActionsClass,
  glossaryRowDeleteBtnClass,
  glossaryTableRowClass,
} from "./glossaryPanelStyles";

type GlossaryTermTableProps = {
  rows: GlossaryTermDto[];
  selectedId: number | null;
  checkedIds: Set<number>;
  deleteConfirmId: number | null;
  disabled: boolean;
  isAllVisibleSelected: boolean;
  isIndeterminate: boolean;
  headerCheckboxRef: RefObject<HTMLInputElement | null>;
  onToggleVisibleSelection: () => void;
  onToggleChecked: (id: number) => void;
  onSelectTerm: (row: GlossaryTermDto) => void;
  onToggleRowHotword: (row: GlossaryTermDto) => void;
  onRowDelete: (id: number) => void;
};

function formatTermDate(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateCell(text: string, max = 48): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function GlossaryTermTable({
  rows,
  selectedId,
  checkedIds,
  deleteConfirmId,
  disabled,
  isAllVisibleSelected,
  headerCheckboxRef,
  onToggleVisibleSelection,
  onToggleChecked,
  onSelectTerm,
  onToggleRowHotword,
  onRowDelete,
}: GlossaryTermTableProps) {
  return (
    <div className={GLOSSARY_TABLE_WRAP}>
      <table className={`${GLOSSARY_TABLE} min-w-[720px]`}>
        <thead>
          <tr className={GLOSSARY_TABLE_HEAD_ROW}>
            <th className="w-10 px-2 py-2">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={isAllVisibleSelected}
                onChange={onToggleVisibleSelection}
                disabled={disabled || rows.length === 0}
                aria-label="全选当前列表"
                className={GLOSSARY_CHECKBOX}
              />
            </th>
            <th className="w-14 px-2 py-2 font-semibold" title="纳入下次转写（热词）">
              热词
            </th>
            <th className={GLOSSARY_TABLE_TH}>主术语</th>
            <th className={GLOSSARY_TABLE_TH}>别名</th>
            <th className={GLOSSARY_TABLE_TH}>领域</th>
            <th className={GLOSSARY_TABLE_TH}>备注</th>
            <th className={GLOSSARY_TABLE_TH}>更新</th>
            <th className={GLOSSARY_TABLE_TH} aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const editing = selectedId === row.id;
            const checked = checkedIds.has(row.id);
            const confirming = deleteConfirmId === row.id;
            const hotwordOn = row.hotword_enabled !== false;
            return (
              <tr key={row.id} className={glossaryTableRowClass({ active: editing, checked })}>
                <td className="px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleChecked(row.id)}
                    disabled={disabled}
                    aria-label={`选择 ${row.term}`}
                    className={GLOSSARY_CHECKBOX}
                  />
                </td>
                <td className="px-2 py-2.5">
                  <button
                    type="button"
                    className={[
                      "inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors disabled:opacity-40",
                      hotwordOn
                        ? "border-zen-saffron/30 bg-zen-saffron/15 text-zen-saffron hover:bg-zen-saffron/25"
                        : "border-notion-border bg-notion-bg text-notion-text-muted hover:bg-notion-sidebar-hover",
                    ].join(" ")}
                    disabled={disabled}
                    onClick={() => void onToggleRowHotword(row)}
                    aria-label={hotwordOn ? `${row.term} 已纳入热词，点击移出` : `${row.term} 未纳入热词，点击纳入`}
                    title={hotwordOn ? "已纳入下次转写（热词），点击移出" : "未纳入下次转写（热词），点击纳入"}
                  >
                    <Flame className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  </button>
                </td>
                <td
                  className="max-w-[140px] cursor-pointer truncate px-3 py-2.5 font-medium text-notion-text"
                  onClick={() => onSelectTerm(row)}
                >
                  {row.term}
                </td>
                <td
                  className="max-w-[120px] cursor-pointer truncate px-3 py-2.5 text-notion-text-muted"
                  onClick={() => onSelectTerm(row)}
                >
                  {truncateCell(row.aliases) || "—"}
                </td>
                <td
                  className="max-w-[100px] cursor-pointer truncate px-3 py-2.5 text-notion-text-muted"
                  onClick={() => onSelectTerm(row)}
                >
                  {truncateCell(row.domain) || "—"}
                </td>
                <td
                  className="max-w-[160px] cursor-pointer truncate px-3 py-2.5 text-notion-text-muted"
                  onClick={() => onSelectTerm(row)}
                >
                  {truncateCell(row.note) || "—"}
                </td>
                <td
                  className="cursor-pointer whitespace-nowrap px-3 py-2.5 text-notion-text-muted"
                  onClick={() => onSelectTerm(row)}
                >
                  {formatTermDate(row.updated_at_ms ?? row.created_at_ms)}
                </td>
                <td className="px-3 py-2.5">
                  <div className={glossaryRowActionsClass(confirming)}>
                    <button
                      type="button"
                      className={glossaryRowDeleteBtnClass(confirming)}
                      disabled={disabled}
                      onClick={() => onRowDelete(row.id)}
                    >
                      <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                      {confirming ? "确认删除" : "删除"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className={`m-0 px-3 py-6 text-center ${PANEL_TYPOGRAPHY.meta}`}>当前列表无词条。</p>
      ) : null}
    </div>
  );
}
