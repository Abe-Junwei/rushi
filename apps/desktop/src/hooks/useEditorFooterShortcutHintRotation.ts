import { useEffect, useState } from "react";
import {
  EDITOR_FOOTER_SHORTCUT_HINTS,
  EDITOR_FOOTER_SHORTCUT_HINT_ROTATION_MS,
  formatEditorFooterShortcutHint,
} from "../utils/editorFooterShortcutHints";

export function useEditorFooterShortcutHintRotation(
  enabled: boolean,
  intervalMs: number = EDITOR_FOOTER_SHORTCUT_HINT_ROTATION_MS,
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % EDITOR_FOOTER_SHORTCUT_HINTS.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs]);

  if (!enabled) return "";
  const hint = EDITOR_FOOTER_SHORTCUT_HINTS[index];
  return hint ? formatEditorFooterShortcutHint(hint) : "";
}
