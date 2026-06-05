export const CORRECTION_RULES_PANEL_ID = "correction-rules-preview-v1";

export function isCorrectionRulesPanelOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.getElementById(CORRECTION_RULES_PANEL_ID) != null;
}
