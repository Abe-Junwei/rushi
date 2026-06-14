import {
  UNSAVED_CLOSE_DISCARD_PROMPT,
  UNSAVED_NAV_DISCARD_PROMPT,
} from "../pages/useSegmentDirtyState";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";

type UnsavedGateIntent = "app-quit" | "navigate";

type UnsavedCloseDialogProps = {
  open: boolean;
  intent: UnsavedGateIntent;
  busy: boolean;
  onStay: () => void;
  onDiscardAndClose: () => void;
  onSaveAndClose: () => void;
};

export function UnsavedCloseDialog({
  open,
  intent,
  busy,
  onStay,
  onDiscardAndClose,
  onSaveAndClose,
}: UnsavedCloseDialogProps) {
  if (!open) return null;

  const prompt =
    intent === "app-quit" ? UNSAVED_CLOSE_DISCARD_PROMPT : UNSAVED_NAV_DISCARD_PROMPT;
  const lines = prompt.split("\n").filter((line) => line.trim().length > 0);
  const stayLabel = intent === "app-quit" ? "留在应用中" : "留在编辑器";
  const discardLabel = intent === "app-quit" ? "放弃并退出" : "放弃并离开";
  const saveLabel = intent === "app-quit" ? "保存并退出" : "保存并离开";

  return (
    <DialogOverlay
      open={open}
      layer="gate"
      onBackdropMouseDown={(e) => {
        if (e.target === e.currentTarget) onStay();
      }}
      onEscapeClose={onStay}
      canEscapeClose={() => !busy}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-close-title"
        aria-describedby="unsaved-close-desc"
        className="w-full max-w-md rounded-md border border-notion-divider bg-notion-bg px-6 py-5 font-sans antialiased shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="unsaved-close-title" className="text-[18px] font-semibold leading-[1.4] text-notion-text">
          未保存的语段修改
        </h2>
        <p id="unsaved-close-desc" className={`mt-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-notion-divider bg-notion-bg px-3 py-1.5 text-sm text-notion-text transition-colors hover:bg-notion-sidebar-hover"
            onClick={onStay}
          >
            {stayLabel}
          </button>
          <button
            type="button"
            className="rounded-md border border-notion-divider bg-notion-sidebar px-3 py-1.5 text-sm text-notion-text transition-colors hover:bg-notion-sidebar-hover"
            onClick={onDiscardAndClose}
          >
            {discardLabel}
          </button>
          <button
            type="button"
            className="rounded-md border-0 bg-zen-saffron-mid px-3 py-1.5 text-sm font-medium text-notion-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={onSaveAndClose}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
