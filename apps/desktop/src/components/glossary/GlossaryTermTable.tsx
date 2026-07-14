import type { RefObject } from "react";
import {
  IconFlame as Flame,
} from "@tabler/icons-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryTermDto } from "../../tauri/glossaryApi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GlossaryListSelectBar } from "./GlossaryListSelectBar";
import {
  GLOSSARY_CHECKBOX,
  GLOSSARY_LIST_ROW_INNER,
  GLOSSARY_LIST_TRAILING_PILL,
  glossaryListRowClass,
} from "./glossaryPanelStyles";

type GlossaryTermTableProps = {
  rows: GlossaryTermDto[];
  selectedId: number | null;
  checkedIds: Set<number>;
  disabled: boolean;
  compact?: boolean;
  isAllVisibleSelected: boolean;
  headerCheckboxRef: RefObject<HTMLInputElement | null>;
  onToggleVisibleSelection: () => void;
  onToggleChecked: (id: number) => void;
  onSelectTerm: (row: GlossaryTermDto) => void;
  onToggleRowHotword: (row: GlossaryTermDto) => void;
};

function truncateAliases(text: string, max = 64): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function GlossaryTermTable({
  rows,
  selectedId,
  checkedIds,
  disabled,
  compact = false,
  isAllVisibleSelected,
  headerCheckboxRef,
  onToggleVisibleSelection,
  onToggleChecked,
  onSelectTerm,
  onToggleRowHotword,
}: GlossaryTermTableProps) {
  if (rows.length === 0) {
    return <p className={`m-0 px-4 py-8 text-center ${PANEL_TYPOGRAPHY.meta}`}>当前列表无词条。</p>;
  }

  const hotwordCount = rows.filter((r) => r.hotword_enabled !== false).length;

  return (
    <div className="flex flex-col">
      <GlossaryListSelectBar
        headerCheckboxRef={headerCheckboxRef}
        isAllVisibleSelected={isAllVisibleSelected}
        onToggleVisibleSelection={onToggleVisibleSelection}
        disabled={disabled}
        rowCount={rows.length}
        trailing={`${rows.length} 条 · ${hotwordCount} 条热词`}
      />

      <ul className="m-0 list-none p-0" role="list" aria-label="转写词汇表">
        {rows.map((row) => {
          const editing = selectedId === row.id;
          const checked = checkedIds.has(row.id);
          const hotwordOn = row.hotword_enabled !== false;
          const aliases = row.aliases.trim();

          return (
            <li key={row.id} className={glossaryListRowClass({ active: editing, checked })}>
              <div className={GLOSSARY_LIST_ROW_INNER}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleChecked(row.id)}
                  disabled={disabled}
                  aria-label={`选择 ${row.term}`}
                  className={[
                    "mt-0.5 shrink-0",
                    GLOSSARY_CHECKBOX,
                    checked || editing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  ].join(" ")}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                  disabled={disabled}
                  onClick={() => onSelectTerm(row)}
                >
                  <span className="block truncate text-sm font-medium text-notion-text">{row.term}</span>
                  {!compact && aliases ? (
                    <span className={`mt-0.5 block truncate ${PANEL_TYPOGRAPHY.meta}`}>
                      {truncateAliases(aliases)}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={[
                    GLOSSARY_LIST_TRAILING_PILL,
                    "mt-0.5 border-0 transition-colors disabled:opacity-40",
                    hotwordOn
                      ? "bg-accent-action/15 text-accent-action hover:bg-accent-action/25"
                      : "bg-notion-callout-bg text-notion-text-light hover:bg-notion-sidebar-hover hover:text-notion-text-muted",
                  ].join(" ")}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggleRowHotword(row);
                  }}
                  aria-label={hotwordOn ? `${row.term} 已纳入热词` : `${row.term} 未纳入热词`}
                  title={hotwordOn ? "已纳入下次转写（热词），点击移出" : "未纳入下次转写（热词），点击纳入"}
                >
                  <Flame className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  <span>{hotwordOn ? "热词" : "未纳入"}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
