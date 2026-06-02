import { ListChecks, Trash2 } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

type Props = {
  selectedCount: number;
  previewLabels: string[];
  hiddenSelectedCount: number;
  disabled: boolean;
  deleteConfirm: boolean;
  canAcceptRules: boolean;
  onAcceptRules: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export function CorrectionMemoryBatchBar({
  selectedCount,
  previewLabels,
  hiddenSelectedCount,
  disabled,
  deleteConfirm,
  canAcceptRules,
  onAcceptRules,
  onDelete,
  onClearSelection,
}: Props) {
  if (selectedCount === 0) return null;

  const preview =
    previewLabels.length > 0
      ? `${previewLabels.join("、")}${selectedCount > previewLabels.length ? ` 等 ${selectedCount} 条` : ""}`
      : `已选 ${selectedCount} 条`;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-notion-callout-bg px-3 py-2">
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
          className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-notion-border bg-notion-bg px-2.5 text-[11px] font-medium text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40"
          disabled={disabled || !canAcceptRules}
          onClick={onAcceptRules}
          title={canAcceptRules ? undefined : "所选条目均已采纳为规则"}
        >
          <ListChecks className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          采纳为规则
        </button>
        <button
          type="button"
          className={[
            "inline-flex min-h-[32px] items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-40",
            deleteConfirm
              ? "border-zen-cinnabar bg-zen-cinnabar/10 text-zen-cinnabar"
              : "border-notion-border bg-notion-bg text-notion-text hover:bg-notion-sidebar-hover",
          ].join(" ")}
          disabled={disabled}
          onClick={onDelete}
        >
          <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          {deleteConfirm ? "确认删除" : "删除"}
        </button>
        <button
          type="button"
          className="min-h-[32px] rounded-md border border-notion-border bg-notion-bg px-2 text-[11px] font-medium text-notion-text-muted transition-colors hover:text-notion-text disabled:opacity-40"
          disabled={disabled}
          onClick={onClearSelection}
        >
          取消选择
        </button>
      </div>
    </div>
  );
}
