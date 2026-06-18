import type { DocxExportMode } from "../tauri/exportDocxApi";

/** 布局变更基线；内容 toggles 见 resolveDeliveryExportLayoutRev。 */
export const DELIVERY_EXPORT_LAYOUT_REV_BASE = 1;

export function resolveDeliveryExportLayoutRev(input: {
  mode: DocxExportMode;
  includeProjectMetadata: boolean;
  metadataLineCount: number;
  polishAvailable: boolean;
  llmPolish: boolean;
  showPolishPreviewSection: boolean;
  polishPreviewLoading: boolean;
  hasPolishPreview: boolean;
  hasPolishPreviewError: boolean;
  hasPolishBlockReason: boolean;
  exportBlockedByPolish: boolean;
  includeAppendix: boolean;
}): number {
  let rev = DELIVERY_EXPORT_LAYOUT_REV_BASE;
  rev += input.mode === "verbatim" ? 0 : input.mode === "lecture" ? 1 : 2;
  if (input.includeProjectMetadata) rev += 10 + input.metadataLineCount;
  if (input.polishAvailable && input.llmPolish) rev += 100;
  if (input.showPolishPreviewSection) rev += 200;
  if (input.polishPreviewLoading) rev += 400;
  if (input.hasPolishPreview) rev += 800;
  if (input.hasPolishPreviewError) rev += 1600;
  if (input.hasPolishBlockReason) rev += 3200;
  if (input.exportBlockedByPolish) rev += 6400;
  if (input.includeAppendix) rev += 128;
  return rev;
}
