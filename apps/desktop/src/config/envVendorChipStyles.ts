/** 环境页 LLM / 在线 STT 厂商 chip 共用（Stitch 描边选中态）。 */
export const ENV_VENDOR_CHIP_BASE =
  "shrink-0 rounded-sm border px-3 py-1.5 text-[12px] transition-colors whitespace-nowrap";

export function envVendorChipClass(active: boolean): string {
  return active
    ? "border-zen-saffron/40 bg-notion-bg font-semibold text-notion-text shadow-sm"
    : "border-transparent bg-notion-sidebar text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text";
}

/** 外链文档（环境面板内） */
export const ENV_EXTERNAL_LINK_CLASS =
  "text-zen-saffron underline decoration-zen-saffron/30 underline-offset-2 hover:text-notion-text";
