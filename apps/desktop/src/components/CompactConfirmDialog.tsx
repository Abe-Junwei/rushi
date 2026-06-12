import type { ReactNode } from "react";
import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
} from "../config/controlStyles";
import { DIALOG_ESCAPE_KEYS_LABEL } from "../utils/dialogPanelHints";
import {
  CompactFloatingDialog,
  type CompactFloatingDialogProps,
} from "./CompactFloatingDialog";
import { FloatingPanelDialogHeader } from "./FloatingPanelDialogLayout";

type ConfirmVariant = "primary" | "danger";

export type CompactConfirmDialogProps = {
  id: string;
  title: string;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busyConfirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  fallbackHeight: number;
  defaultWidth?: number;
  bounds?: CompactFloatingDialogProps["bounds"];
  persistState?: boolean;
  rootRole?: string;
  children: ReactNode;
};

/** 短文案确认框：Header 说明 + 标准页脚（取消 + 确认，同 h-8）。 */
export function CompactConfirmDialog({
  id,
  title,
  open,
  busy = false,
  onCancel,
  onConfirm,
  confirmLabel,
  busyConfirmLabel,
  cancelLabel = "取消",
  confirmVariant = "primary",
  fallbackHeight,
  defaultWidth,
  bounds,
  persistState,
  rootRole = "alertdialog",
  children,
}: CompactConfirmDialogProps) {
  const confirmClass = confirmVariant === "danger" ? CONTROL_BTN_DANGER : CONTROL_BTN_PRIMARY;

  const handleClose = () => {
    if (!busy) onCancel();
  };

  return (
    <CompactFloatingDialog
      id={id}
      title={title}
      open={open}
      onClose={handleClose}
      fallbackHeight={fallbackHeight}
      defaultWidth={defaultWidth}
      bounds={bounds}
      persistState={persistState}
      rootRole={rootRole}
      footer={
        <>
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={busy}
            title={`${cancelLabel} (${DIALOG_ESCAPE_KEYS_LABEL})`}
            onClick={handleClose}
          >
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} disabled={busy} onClick={onConfirm}>
            {busy ? (busyConfirmLabel ?? confirmLabel) : confirmLabel}
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogHeader>{children}</FloatingPanelDialogHeader>
    </CompactFloatingDialog>
  );
}
