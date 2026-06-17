import { overlayScrimCentered } from "./overlayStyles";

export type DialogStackLayer = "overlay" | "modal" | "gate";

/** 须写完整字面量，Tailwind JIT 无法扫描模板字符串中的 z-[n]。 */
const DIALOG_OVERLAY_CLASS: Record<DialogStackLayer, string> = {
  overlay: overlayScrimCentered("z-[100]"),
  modal: overlayScrimCentered("z-[110]"),
  gate: overlayScrimCentered("z-[120]"),
};

export function dialogOverlayClass(layer: DialogStackLayer): string {
  return DIALOG_OVERLAY_CLASS[layer];
}
