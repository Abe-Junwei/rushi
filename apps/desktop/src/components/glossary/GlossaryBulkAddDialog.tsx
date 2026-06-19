import { useMemo, type KeyboardEvent } from "react";
import { PRODUCT_ICON } from "../../config/productIcons";
import {
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_TEXTAREA,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { splitGlossaryPasteInput } from "../../services/glossaryPasteSplit";
import { CompactFloatingDialog } from "../CompactFloatingDialog";
import { FloatingPanelDialogHeader } from "../FloatingPanelDialogLayout";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

const PANEL_ID = "glossary-bulk-add-v1";
const FALLBACK_HEIGHT = 320;

type Props = {
  bulkPaste: string;
  disabled: boolean;
  busy: boolean;
  onBulkPasteChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onImportFromFile: () => void;
};

export function GlossaryBulkAddDialog({
  bulkPaste,
  disabled,
  busy,
  onBulkPasteChange,
  onCancel,
  onConfirm,
  onImportFromFile,
}: Props) {
  const pieceCount = useMemo(() => splitGlossaryPasteInput(bulkPaste).length, [bulkPaste]);
  const canSubmit = pieceCount > 0 && !disabled && !busy;

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
      e.preventDefault();
      onConfirm();
    }
  };

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="批量添加"
      open
      onClose={() => {
        if (!disabled && !busy) onCancel();
      }}
      fallbackHeight={FALLBACK_HEIGHT}
      fitKind="staticFit"
      defaultWidth={480}
      bounds={{ minWidth: 400, minHeight: 280, maxWidthCap: 520, maxHeightCap: 480 }}
      footer={
        <>
          <button
            type="button"
            className={`${CONTROL_BTN_SECONDARY} gap-1.5`}
            disabled={disabled || busy}
            onClick={onImportFromFile}
          >
            <PRODUCT_ICON.navGlossaryBundle className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            从表格导入…
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={disabled || busy} onClick={onCancel}>
              取消
            </button>
            <button
              type="button"
              className={CONTROL_BTN_PRIMARY}
              disabled={!canSubmit}
              onClick={onConfirm}
            >
              {busy ? "添加中…" : "批量添加"}
            </button>
          </div>
        </>
      }
      footerJustify="between"
    >
      <FloatingPanelDialogHeader>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          粘贴 Excel 选区（Tab 分列、换行分行）或逗号/顿号分隔；默认纳入热词。
        </p>
      </FloatingPanelDialogHeader>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <textarea
          value={bulkPaste}
          disabled={disabled || busy}
          rows={5}
          placeholder={"香板\n提持\n上座"}
          className={`${CONTROL_TEXTAREA} min-h-[120px]`}
          aria-label="批量粘贴术语"
          onChange={(e) => onBulkPasteChange(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
        />
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
          {pieceCount > 0 ? `将添加 ${pieceCount} 条` : "⌘↵ / Ctrl+Enter 快速提交"}
        </p>
      </div>
    </CompactFloatingDialog>
  );
}
