import {
  UNSAVED_CLOSE_DISCARD_PROMPT,
  UNSAVED_NAV_DISCARD_PROMPT,
} from "../pages/useSegmentDirtyState";
import {
  CONTROL_BTN_GHOST,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
} from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
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
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="unsaved-close-title" className={COMPACT_DIALOG_LAYOUT.title}>
            未保存的语段修改
          </h2>
          <p id="unsaved-close-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            {lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <div className={COMPACT_DIALOG_LAYOUT.actionRowSplit}>
            <button type="button" className={CONTROL_BTN_GHOST} onClick={onStay}>
              {stayLabel}
            </button>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onDiscardAndClose}>
                {discardLabel}
              </button>
              <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onSaveAndClose}>
                {saveLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
