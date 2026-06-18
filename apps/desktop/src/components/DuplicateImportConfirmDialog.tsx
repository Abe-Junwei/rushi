import { LoaderCircle } from "lucide-react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { DialogOverlay } from "./DialogOverlay";
import {
  buildDuplicateImportConfirmBody,
  canOpenExistingDuplicate,
  type ImportDuplicateCheck,
} from "../utils/projectImportDuplicate";

type DuplicateImportConfirmDialogProps = {
  open: boolean;
  checking: boolean;
  check: ImportDuplicateCheck | null;
  onCancel: () => void;
  onOpenExisting: () => void;
  onConfirmCopy: () => void;
};

export function DuplicateImportConfirmDialog({
  open,
  checking,
  check,
  onCancel,
  onOpenExisting,
  onConfirmCopy,
}: DuplicateImportConfirmDialogProps) {
  if (!open && !checking) return null;

  const canOpenExisting = check ? canOpenExistingDuplicate(check) : false;

  return (
    <DialogOverlay
      open={open || checking}
      layer="modal"
      onBackdropMouseDown={(e) => {
        if (e.target === e.currentTarget && !checking) onCancel();
      }}
      onEscapeClose={onCancel}
      canEscapeClose={() => !checking}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="duplicate-import-title"
        aria-describedby="duplicate-import-desc"
        aria-busy={checking}
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {checking ? (
          <div className={COMPACT_DIALOG_LAYOUT.stack}>
            <h2 id="duplicate-import-title" className={COMPACT_DIALOG_LAYOUT.title}>
              正在检测重复导入
            </h2>
            <p id="duplicate-import-desc" className={`flex items-center gap-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>
              <LoaderCircle
                className={`${LUCIDE_ICON_SIZE_MD} shrink-0 animate-spin text-accent-action`}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
              正在比对文件路径与内容，请稍候…
            </p>
          </div>
        ) : check ? (
          <div className={COMPACT_DIALOG_LAYOUT.stack}>
            <h2 id="duplicate-import-title" className={COMPACT_DIALOG_LAYOUT.title}>
              检测到重复导入
            </h2>
            <p id="duplicate-import-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
              {buildDuplicateImportConfirmBody(check)}
            </p>
            <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
              <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCancel}>
                取消
              </button>
              {canOpenExisting ? (
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onOpenExisting}>
                  打开已有
                </button>
              ) : null}
              <button type="button" className={CONTROL_BTN_PRIMARY} onClick={onConfirmCopy}>
                仍要导入
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </DialogOverlay>
  );
}
