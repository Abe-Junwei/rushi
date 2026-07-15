import type { DocxExportMode } from "../tauri/exportDocxApi";

export const DELIVERY_EXPORT_MODE_OPTIONS: { id: DocxExportMode; label: string; hint: string }[] = [
  {
    id: "verbatim",
    label: "逐字稿",
    hint: "每段带起止时间码，正文与时间行分开排版。",
  },
  {
    id: "lecture",
    label: "讲稿",
    hint: "按语段自然段；各连续块左上/右下标起止时间，块间空行；文末写录音文件名。",
  },
  {
    id: "clean",
    label: "干净稿",
    hint: "版式同讲稿（段间空行）；导出时自动大模型润色整理。",
  },
];

export function resolveDocxExportModeLabel(mode: DocxExportMode): string {
  return DELIVERY_EXPORT_MODE_OPTIONS.find((o) => o.id === mode)?.label ?? "导出";
}
