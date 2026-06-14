/** 术语表 / 热词 preview 变更通知（F6 / F6+ 写入后刷新 GlossaryPage）。 */

const GLOSSARY_DATA_CHANGED = "rushi:glossary-data-changed";

export function notifyGlossaryDataChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GLOSSARY_DATA_CHANGED));
}
