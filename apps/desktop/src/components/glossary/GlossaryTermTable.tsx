import type { RefObject } from "react";
import { Flame, Trash2 } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryTermDto } from "../../tauri/glossaryApi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

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
    <div className="overflow-x-auto rounded-md border border-notion-divider">
      <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-notion-divider bg-notion-callout-bg text-notion-text-muted">
            <th className="w-10 px-2 py-2">
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={isAllVisibleSelected}
                onChange={onToggleVisibleSelection}
                disabled={disabled || rows.length === 0}
                aria-label="全选当前列表"
                className="h-4 w-4 rounded border-notion-border text-zen-saffron focus:ring-zen-saffron/30"
              />
            </th>
            <th className="w-14 px-2 py-2 font-semibold" title="纳入下次转写（热词）">
              热词
            </th>
            <th className="px-3 py-2 font-semibold">主术语</th>
            <th className="px-3 py-2 font-semibold">别名</th>
            <th className="px-3 py-2 font-semibold">领域</th>
            <th className="px-3 py-2 font-semibold">备注</th>
            <th className="px-3 py-2 font-semibold">更新</th>
            <th className="px-3 py-2 font-semibold" aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const editing = selectedId === row.id;
            const checked = checkedIds.has(row.id);
            const confirming = deleteConfirmId === row.id;
            const hotwordOn = row.hotword_enabled !== false;
            return (
              <tr
                key={row.id}
                className={[
                  "border-b border-notion-divider/60 transition-colors last:border-b-0",
                  editing ? "bg-zen-saffron/10" : checked ? "bg-notion-callout-bg/80" : "bg-notion-bg hover:bg-notion-sidebar-hover/60",
                ].join(" ")}
              >
                <td className="px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleChecked(row.id)}
                    disabled={disabled}
                    aria-label={`选择 ${row.term}`}
                    className="h-4 w-4 rounded border-notion-border text-zen-saffron focus:ring-zen-saffron/30"
                  />
                </td>
                <td className="px-2 py-2.5">
                  <button
                    type="button"
                    className={[
                      "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
                      hotwordOn
                        ? "border-zen-saffron/30 bg-zen-saffron/15 text-zen-saffron hover:bg-zen-saffron/25"
                        : "border-notion-border bg-notion-callout-bg text-notion-text-muted hover:bg-notion-sidebar-hover",
                    ].join(" ")}
                    disabled={disabled}
                    onClick={() => void onToggleRowHotword(row)}
                    aria-label={hotwordOn ? `${row.term} 已纳入热词，点击移出` : `${row.term} 未纳入热词，点击纳入`}
                    title={hotwordOn ? "已纳入下次转写（热词）" : "未纳入下次转写（热词）"}
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
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={[
                        "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                        hotwordOn
                          ? "border-zen-saffron/30 bg-notion-bg text-zen-saffron hover:bg-zen-saffron/10"
                          : "border-notion-border bg-notion-bg text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
                      ].join(" ")}
                      disabled={disabled}
                      onClick={() => void onToggleRowHotword(row)}
                    >
                      {hotwordOn ? "移出热词" : "纳入热词"}
                    </button>
                    <button
                      type="button"
                      className={[
                        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                        confirming
                          ? "border-zen-cinnabar bg-zen-cinnabar/10 text-zen-cinnabar"
                          : "border-notion-border bg-notion-bg text-notion-text hover:bg-notion-sidebar-hover",
                      ].join(" ")}
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
