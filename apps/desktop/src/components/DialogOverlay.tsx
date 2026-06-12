import { createPortal } from "react-dom";
import type { MouseEvent, ReactNode } from "react";
import { useDialogEscapeClose } from "../hooks/useDialogEscapeClose";
import { dialogOverlayClass, type DialogStackLayer } from "../config/dialogStack";

type DialogOverlayProps = {
  open: boolean;
  layer: DialogStackLayer;
  onBackdropMouseDown?: (event: MouseEvent<HTMLDivElement>) => void;
  onEscapeClose?: () => void;
  canEscapeClose?: () => boolean;
  children: ReactNode;
};

/** Close Gate / 确认框：挂到 body，避免被 .workspace 内 stacking context 遮挡。 */
export function DialogOverlay({
  open,
  layer,
  onBackdropMouseDown,
  onEscapeClose,
  canEscapeClose,
  children,
}: DialogOverlayProps) {
  useDialogEscapeClose(open && onEscapeClose != null, onEscapeClose ?? (() => {}), canEscapeClose);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={dialogOverlayClass(layer)} role="presentation" onMouseDown={onBackdropMouseDown}>
      {children}
    </div>,
    document.body,
  );
}
