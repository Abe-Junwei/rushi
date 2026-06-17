export type DialogStackLayer = "overlay" | "modal" | "gate";

/** 须写完整字面量，Tailwind JIT 无法扫描模板字符串中的 z-[n]。 */
const DIALOG_OVERLAY_CLASS: Record<DialogStackLayer, string> = {
  overlay:
    "fixed inset-0 z-[100] flex items-center justify-center bg-zen-ink/25 p-6 backdrop-blur-[2px]",
  modal:
    "fixed inset-0 z-[110] flex items-center justify-center bg-zen-ink/25 p-6 backdrop-blur-[2px]",
  gate:
    "fixed inset-0 z-[120] flex items-center justify-center bg-zen-ink/25 p-6 backdrop-blur-[2px]",
};

export function dialogOverlayClass(layer: DialogStackLayer): string {
  return DIALOG_OVERLAY_CLASS[layer];
}
