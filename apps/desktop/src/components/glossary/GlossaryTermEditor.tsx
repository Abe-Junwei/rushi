import {
  IconDeviceFloppy as Save,
  IconTrash as Trash2,
} from "@tabler/icons-react";
import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_TEXTAREA,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryEditorDraft } from "../../services/glossaryTermHelpers";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_CHECKBOX } from "./glossaryPanelStyles";

type GlossaryTermEditorProps = {
  mode: "create" | "edit";
  draft: GlossaryEditorDraft;
  disabled: boolean;
  onChange: (key: keyof GlossaryEditorDraft, value: string | boolean) => void;
  onSave: () => void;
  onReset: () => void;
  onDelete?: () => void;
};

export function GlossaryTermEditor({
  mode,
  draft,
  disabled,
  onChange,
  onSave,
  onReset,
  onDelete,
}: GlossaryTermEditorProps) {
  const isEdit = mode === "edit";

  const fields = (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>主术语</span>
        <input
          type="text"
          value={draft.term}
          onChange={(e) => onChange("term", e.target.value)}
          disabled={disabled}
          placeholder="必填"
          className={CONTROL_TEXT_INPUT}
        />
      </label>

      <label className="flex cursor-pointer gap-2">
        <input
          type="checkbox"
          checked={draft.hotwordEnabled}
          onChange={(e) => onChange("hotwordEnabled", e.target.checked)}
          disabled={disabled}
          className={`mt-0.5 shrink-0 ${GLOSSARY_CHECKBOX}`}
        />
        <span className="flex flex-col gap-0.5">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>纳入下次转写（热词）</span>
          <span className="text-label leading-snug text-notion-text-muted">
            勾选后主术语与别名会进入下次 ASR 热词串。
          </span>
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>别名</span>
        <input
          type="text"
          value={draft.aliases}
          onChange={(e) => onChange("aliases", e.target.value)}
          disabled={disabled}
          placeholder="异体字或英文；勿填常听错的错形"
          className={CONTROL_TEXT_INPUT}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>领域 / 标签</span>
        <input
          type="text"
          value={draft.domain}
          onChange={(e) => onChange("domain", e.target.value)}
          disabled={disabled}
          placeholder="如：佛学、医学"
          className={CONTROL_TEXT_INPUT}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>备注</span>
        <textarea
          value={draft.note}
          onChange={(e) => onChange("note", e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="用法说明、出处等"
          className={`${CONTROL_TEXTAREA} min-h-[72px]`}
        />
      </label>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`${CONTROL_BTN_PRIMARY} flex-1 gap-1.5`}
        disabled={disabled || !draft.term.trim()}
        onClick={onSave}
      >
        <Save className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        {isEdit ? "保存修改" : "添加词条"}
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
          aria-label="删除词条"
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
