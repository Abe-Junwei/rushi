import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_PRIMARY,
  CONTROL_TEXTAREA,
  CONTROL_TEXT_INPUT,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryEditorDraft } from "../../services/glossaryTermHelpers";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_CARD, GLOSSARY_CHECKBOX } from "./glossaryPanelStyles";

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

  return (
    <div className={`${GLOSSARY_CARD} flex flex-col gap-4 px-4 py-4`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>
          {isEdit ? (
            <span className="inline-flex items-center gap-1.5">
              <Pencil className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              编辑词条
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Plus className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              新建词条
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
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

        <label className="flex cursor-pointer gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.hotwordEnabled}
            onChange={(e) => onChange("hotwordEnabled", e.target.checked)}
            disabled={disabled}
            className={`mt-0.5 shrink-0 ${GLOSSARY_CHECKBOX}`}
          />
          <span className="flex flex-col gap-0.5">
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>纳入下次转写（热词）</span>
            <span className="text-xs text-notion-text-muted">
              勾选后主术语与别名会进入下次 ASR 拉取的热词串；纠错记忆中的错形不会进入热词。
            </span>
          </span>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>别名</span>
          <input
            type="text"
            value={draft.aliases}
            onChange={(e) => onChange("aliases", e.target.value)}
            disabled={disabled}
            placeholder="可填异体字或英文；勿填常听错的错形（如智控）"
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
            placeholder="如：佛学、医学（预留词典字段）"
            className={CONTROL_TEXT_INPUT}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>备注</span>
          <textarea
            value={draft.note}
            onChange={(e) => onChange("note", e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="用法说明、出处等；远期可升级为词典词条的注释"
            className={`${CONTROL_TEXTAREA} min-h-[72px]`}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${CONTROL_BTN_PRIMARY} gap-1.5`}
          disabled={disabled || !draft.term.trim()}
          onClick={onSave}
        >
          <Save className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          {isEdit ? "保存修改" : "添加词条"}
        </button>
        {isEdit && onDelete ? (
          <button
            type="button"
            className={`${CONTROL_BTN_DANGER} gap-1.5`}
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            删除
          </button>
        ) : null}
      </div>
    </div>
  );
}
