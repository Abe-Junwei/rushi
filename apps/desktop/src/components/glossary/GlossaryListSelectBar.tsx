import type { RefObject } from "react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { GLOSSARY_CHECKBOX, GLOSSARY_LIST_SELECT_BAR } from "./glossaryPanelStyles";

type Props = {
  headerCheckboxRef: RefObject<HTMLInputElement | null>;
  isAllVisibleSelected: boolean;
  onToggleVisibleSelection: () => void;
  disabled: boolean;
  rowCount: number;
  trailing?: string;
};

export function GlossaryListSelectBar({
  headerCheckboxRef,
  isAllVisibleSelected,
  onToggleVisibleSelection,
  disabled,
  rowCount,
  trailing,
}: Props) {
  return (
    <div className={GLOSSARY_LIST_SELECT_BAR}>
      <div className="flex min-w-0 items-center gap-2">
        <input
          ref={headerCheckboxRef}
          type="checkbox"
          checked={isAllVisibleSelected}
          onChange={onToggleVisibleSelection}
          disabled={disabled || rowCount === 0}
          aria-label="全选当前列表"
          className={GLOSSARY_CHECKBOX}
        />
        <span className={PANEL_TYPOGRAPHY.meta}>全选</span>
      </div>
      <span className={`shrink-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
        {trailing ?? `${rowCount} 条`}
      </span>
    </div>
  );
}
