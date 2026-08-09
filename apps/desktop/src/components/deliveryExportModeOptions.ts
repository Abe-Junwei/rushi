import type { DocxExportMode } from "../tauri/exportDocxApi";

export const DELIVERY_EXPORT_MODE_OPTIONS: { id: DocxExportMode; label: string; hint: string }[] = [
  {
    id: "verbatim",
    label: "逐字稿",
    hint: "每段带起止时间码，正文与时间行分开排版。",
  },
  {
    id: "clean",
    label: "LLM 保真整理",
    hint: "保留正文内容，只整理可信错字、标点和自然段，并附 Word 修订轨。",
  },
  {
    id: "lecture",
    label: "讲稿优化",
    hint: "去赘词、理语序并修正语病，直接导出可逐条接受或拒绝的 Word 修订稿。",
  },
];

export function resolveDocxExportModeLabel(mode: DocxExportMode): string {
  return DELIVERY_EXPORT_MODE_OPTIONS.find((o) => o.id === mode)?.label ?? "导出";
}
