import { Save, Trash2 } from "lucide-react";
import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { CorrectionMemoryDraft } from "../../services/correctionMemoryHelpers";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_CHECKBOX } from "./glossaryPanelStyles";

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
  const canSave =
    draft.wrong.trim() !== "" && draft.right.trim() !== "" && draft.wrong.trim() !== draft.right.trim();

  const fields = (
    <div className="flex flex-col gap-3">
      <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
        错词不会进入 ASR 热词。命中 ≥3 次或勾选「采纳为规则」后可用于工具栏「纠错规则」；满 3 次时正词会自动加入术语表。
      </p>

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

      <label className="inline-flex cursor-pointer items-start gap-2 text-sm text-notion-text">
        <input
          type="checkbox"
          checked={draft.acceptedAsRule}
          disabled={disabled}
          onChange={(e) => onChange("acceptedAsRule", e.target.checked)}
          className={`mt-0.5 shrink-0 ${GLOSSARY_CHECKBOX}`}
        />
        <span className="flex flex-col gap-0.5">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>采纳为规则</span>
          <span className="text-label leading-snug text-notion-text-muted">
            立即用于 F1 / 转写提示，不等待命中次数
          </span>
        </span>
      </label>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`${CONTROL_BTN_PRIMARY} flex-1 gap-1.5`}
        disabled={disabled || !canSave}
        onClick={onSave}
      >
        <Save className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        {isEdit ? "保存修改" : "添加记忆"}
      </button>
      <button type="button" className={`${CONTROL_BTN_SECONDARY} flex-1`} disabled={disabled} onClick={onReset}>
        取消
      </button>
      {isEdit && onDelete ? (
        <button
          type="button"
          className={`${CONTROL_BTN_DANGER} shrink-0 gap-1.5 px-3`}
          disabled={disabled}
          onClick={onDelete}
          aria-label="删除纠错记忆"
        >
          <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1">{fields}</div>
      <div className="shrink-0 border-t border-notion-divider pt-4">{footer}</div>
    </div>
  );
}
