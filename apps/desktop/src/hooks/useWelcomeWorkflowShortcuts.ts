import { useEffect } from "react";
import { matchEditorShortcut } from "../utils/editorShortcutRegistry";
import { requestCloseActivityInbox, requestToggleActivityInbox } from "../services/ui/activityInboxEvents";

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  const field = el.closest("textarea, input, select, [contenteditable='true'], [contenteditable='']");
  if (!field) return false;
  if (field instanceof HTMLInputElement) {
    const type = field.type.toLowerCase();
    if (type === "button" || type === "submit" || type === "reset" || type === "checkbox" || type === "radio") {
      return false;
    }
  }
  return true;
}

/** 欢迎页 / Hub 无编辑器快捷键层时，处理全局工作流快捷键。 */
export function useWelcomeWorkflowShortcuts({
  enabled,
  onOpenSettings,
}: {
  enabled: boolean;
  onOpenSettings: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const inTextarea = isEditableKeyboardTarget(e.target);
      const shortcutId = matchEditorShortcut(e, { inTextarea });
      if (!shortcutId) return;
      if (shortcutId === "workflow.openSettings") {
        e.preventDefault();
        onOpenSettings();
        return;
      }
      if (shortcutId === "workflow.openActivityInbox") {
        e.preventDefault();
        requestToggleActivityInbox();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, onOpenSettings]);
}

export { requestCloseActivityInbox };
