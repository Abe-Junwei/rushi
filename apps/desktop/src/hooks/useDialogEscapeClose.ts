import { useEffect, useRef } from "react";
import { registerDialogEscape } from "../utils/dialogEscapeStack";

export function useDialogEscapeClose(
  enabled: boolean,
  onClose: () => void,
  canClose?: () => boolean,
): void {
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  onCloseRef.current = onClose;
  canCloseRef.current = canClose;

  useEffect(() => {
    if (!enabled) return;

    return registerDialogEscape({
      close: () => onCloseRef.current(),
      canClose: () => canCloseRef.current?.() ?? true,
    });
  }, [enabled]);
}
