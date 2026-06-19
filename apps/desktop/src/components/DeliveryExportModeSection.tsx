import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import { DELIVERY_EXPORT_MODE_OPTIONS } from "./deliveryExportModeOptions";

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
