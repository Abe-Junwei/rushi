import { LoaderCircle } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
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
        className="w-full max-w-md rounded-md border border-notion-divider bg-notion-bg px-6 py-5 font-sans antialiased shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {checking ? (
          <>
            <h2 id="duplicate-import-title" className="text-[18px] font-semibold leading-[1.4] text-notion-text">
              正在检测重复导入
            </h2>
            <p id="duplicate-import-desc" className={`mt-2 flex items-center gap-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>
              <LoaderCircle
                className={`${LUCIDE_ICON_SIZE_MD} shrink-0 animate-spin text-zen-saffron`}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
              正在比对文件路径与内容，请稍候…
            </p>
          </>
        ) : check ? (
          <>
            <h2 id="duplicate-import-title" className="text-[18px] font-semibold leading-[1.4] text-notion-text">
              检测到重复导入
            </h2>
            <p id="duplicate-import-desc" className={`mt-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>
              {buildDuplicateImportConfirmBody(check)}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border border-notion-border bg-notion-bg px-3 text-[12px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
                onClick={onCancel}
              >
                取消
              </button>
              {canOpenExisting ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-notion-border bg-notion-bg px-3 text-[12px] font-medium text-notion-text transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
                  onClick={onOpenExisting}
                >
                  打开已有
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md border-0 bg-zen-saffron px-3 text-[12px] font-medium text-white transition-colors hover:bg-zen-saffron-mid"
                onClick={onConfirmCopy}
              >
                仍要导入
              </button>
            </div>
          </>
        ) : null}
      </div>
    </DialogOverlay>
  );
}
