import { Trash2 } from "lucide-react";
import { ENV_COMPACT_BTN } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { glossaryRowDeleteBtnClass } from "./glossaryPanelStyles";

type GlossaryBatchBarProps = {
  selectedCount: number;
  previewLabels: string[];
  hiddenSelectedCount: number;
  disabled: boolean;
  deleteConfirm: boolean;
  canEnableHotwords: boolean;
  canDisableHotwords: boolean;
  onEnableHotwords: () => void;
  onDisableHotwords: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export function GlossaryBatchBar({
  selectedCount,
  previewLabels,
  hiddenSelectedCount,
  disabled,
  deleteConfirm,
  canEnableHotwords,
  canDisableHotwords,
  onEnableHotwords,
  onDisableHotwords,
  onDelete,
  onClearSelection,
}: GlossaryBatchBarProps) {
  if (selectedCount === 0) return null;

  const preview =
    previewLabels.length > 0
      ? `${previewLabels.join("、")}${selectedCount > previewLabels.length ? ` 等 ${selectedCount} 条` : ""}`
      : `已选 ${selectedCount} 条`;

  return (
    <div className="flex flex-col gap-2 rounded-md bg-notion-callout-bg px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={PANEL_TYPOGRAPHY.meta}>{preview}</span>
        {hiddenSelectedCount > 0 ? (
          <span className={`${PANEL_TYPOGRAPHY.meta} text-zen-saffron`}>
            （含 {hiddenSelectedCount} 条不在当前列表）
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={ENV_COMPACT_BTN}
          disabled={disabled || !canEnableHotwords}
          onClick={onEnableHotwords}
          title={canEnableHotwords ? undefined : "所选词条均已纳入热词"}
        >
          纳入热词
        </button>
        <button
          type="button"
          className={ENV_COMPACT_BTN}
          disabled={disabled || !canDisableHotwords}
          onClick={onDisableHotwords}
          title={canDisableHotwords ? undefined : "所选词条均未纳入热词"}
        >
          移出热词
        </button>
        <button
          type="button"
          className={glossaryRowDeleteBtnClass(deleteConfirm)}
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          {deleteConfirm ? "确认删除" : "删除"}
        </button>
        <button
          type="button"
          className={ENV_COMPACT_BTN}
          disabled={disabled}
          onClick={onClearSelection}
        >
          取消选择
        </button>
      </div>
    </div>
  );
}
