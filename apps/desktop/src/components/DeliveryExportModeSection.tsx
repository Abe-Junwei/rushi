import type { DocxExportMode } from "../tauri/exportDocxApi";
import { PANEL_TYPOGRAPHY } from "../config/typography";

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

type Props = {
  mode: DocxExportMode;
  exportBusy: boolean;
  onModeChange: (mode: DocxExportMode) => void;
};

export function DeliveryExportModeSection({ mode, exportBusy, onModeChange }: Props) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-xs font-semibold uppercase tracking-wide text-notion-text-light">
        版式
      </legend>
      {DELIVERY_EXPORT_MODE_OPTIONS.map((opt) => (
        <label
          key={opt.id}
          className="flex cursor-pointer gap-2 rounded-md border border-notion-divider bg-notion-callout-bg px-3 py-2 has-[:checked]:border-accent-action/40"
        >
          <input
            type="radio"
            name="docx-export-mode"
            className="mt-1"
            checked={mode === opt.id}
            disabled={exportBusy}
            onChange={() => onModeChange(opt.id)}
          />
          <span className="min-w-0">
            <span className={`block font-semibold ${PANEL_TYPOGRAPHY.dialogText}`}>{opt.label}</span>
            <span className="block text-xs leading-snug text-notion-text-muted">{opt.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
