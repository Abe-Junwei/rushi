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

/** 壳层/layout 变更时 bump，丢弃旧 persist 高度。2 = CSS 自动高度单一真源（FLOAT-FIT）。 */
export const COMPACT_CONFIRM_LAYOUT_REV_BASE = 2;

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
  layoutRev?: number;
  rootRole?: string;
  /** 从更高层浮层（如设置面板 z-110）内部弹出时须抬层，否则会被父面板压住而“看不见”。 */
  panelZIndex?: number;
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
  layoutRev = COMPACT_CONFIRM_LAYOUT_REV_BASE,
  rootRole = "alertdialog",
  panelZIndex,
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
      fitKind="staticFit"
      fallbackHeight={fallbackHeight}
      defaultWidth={defaultWidth}
      bounds={bounds}
      persistState={persistState}
      layoutRev={layoutRev}
      rootRole={rootRole}
      panelZIndex={panelZIndex}
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
