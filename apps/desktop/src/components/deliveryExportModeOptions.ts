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
    hint: "默认按语段自然段；可选大模型润色（Word 修订模式显示改动）。",
  },
  {
    id: "clean",
    label: "干净稿",
    hint: "默认按语段分段；可选大模型润色（段间空行，修订模式显示改动）。",
  },
];
