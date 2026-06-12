import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_PRIMARY,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { CorrectionMemoryDraft } from "../../services/correctionMemoryHelpers";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_CARD, GLOSSARY_CHECKBOX } from "./glossaryPanelStyles";

type Props = {
  mode: "create" | "edit";
  draft: CorrectionMemoryDraft;
  disabled: boolean;
  onChange: (key: keyof CorrectionMemoryDraft, value: string | boolean) => void;
  onSave: () => void;
  onReset: () => void;
  onDelete?: () => void;
};

export function CorrectionMemoryEditor({
  mode,
  draft,
  disabled,
  onChange,
  onSave,
  onReset,
  onDelete,
}: Props) {
  const isEdit = mode === "edit";
  const canSave = draft.wrong.trim() !== "" && draft.right.trim() !== "" && draft.wrong.trim() !== draft.right.trim();

  return (
    <div className={`${GLOSSARY_CARD} flex flex-col gap-4 px-4 py-4`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>
          {isEdit ? (
            <span className="inline-flex items-center gap-1.5">
              <Pencil className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              编辑纠错记忆
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Plus className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              新建纠错记忆
            </span>
          )}
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm border-0 bg-transparent px-2 py-1 text-[11px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
          disabled={disabled}
          onClick={onReset}
        >
          <X className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          {isEdit ? "取消" : "收起"}
        </button>
      </div>

      <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
        错词不会进入 ASR 热词。命中 ≥3 次或勾选「采纳为规则」后可用于工具栏「纠错规则」；满 3 次时正词会自动加入术语表（改善下次转写）。
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>错词（转写/稿中常见形）</span>
          <input
            type="text"
            value={draft.wrong}
            disabled={disabled}
            onChange={(e) => onChange("wrong", e.target.value)}
            className={CONTROL_TEXT_INPUT}
            placeholder="例如：智控"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>正词（期望写法）</span>
          <input
            type="text"
            value={draft.right}
            disabled={disabled}
            onChange={(e) => onChange("right", e.target.value)}
            className={CONTROL_TEXT_INPUT}
            placeholder="例如：制控"
          />
        </label>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-notion-text">
        <input
          type="checkbox"
          checked={draft.acceptedAsRule}
          disabled={disabled}
          onChange={(e) => onChange("acceptedAsRule", e.target.checked)}
          className={GLOSSARY_CHECKBOX}
        />
        采纳为规则（立即用于 F1 / 转写提示，不等待命中次数）
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${CONTROL_BTN_PRIMARY} gap-1.5`}
          disabled={disabled || !canSave}
          onClick={onSave}
        >
          <Save className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          保存
        </button>
        {isEdit && onDelete ? (
          <button
            type="button"
            className={`${CONTROL_BTN_DANGER} gap-1.5`}
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            删除本条
          </button>
        ) : null}
      </div>
    </div>
  );
}
