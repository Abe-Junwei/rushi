import type { EditorShortcutId, ShortcutBinding } from "./editorShortcutRegistry";
import { getEditorShortcutDefinition } from "./editorShortcutRegistry";

export type ShortcutMenuPlatform = "mac" | "win";

export function detectShortcutMenuPlatform(
  platform = typeof navigator !== "undefined" ? navigator.platform : "",
): ShortcutMenuPlatform {
  return /Mac|iPod|iPhone|iPad/.test(platform) ? "mac" : "win";
}

function formatMenuKey(key: string, isMac: boolean): string {
  if (key === " ") return "Space";
  if (key === ",") return ",";
  if (key === "Enter") return isMac ? "↩" : "Enter";
  if (key === "Backspace") return isMac ? "⌫" : "Backspace";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** 右键菜单等紧凑场景：sans 展示，避免 font-mono 与 ⌘/中文混排。 */
export function formatShortcutBindingMenuLabel(
  binding: ShortcutBinding,
  platform: ShortcutMenuPlatform = detectShortcutMenuPlatform(),
): string {
  const isMac = platform === "mac";
  if (isMac) {
    let out = "";
    if (binding.shift) out += "⇧";
    if (binding.mod) out += "⌘";
    if (binding.alt) out += "⌥";
    out += formatMenuKey(binding.key, true);
    return out;
  }

  const parts: string[] = [];
  if (binding.shift) parts.push("Shift");
  if (binding.mod) parts.push("Ctrl");
  if (binding.alt) parts.push("Alt");
  parts.push(formatMenuKey(binding.key, false));
  return parts.join("+");
}

export function editorShortcutMenuHint(
  id: EditorShortcutId,
  platform: ShortcutMenuPlatform = detectShortcutMenuPlatform(),
): string {
  const def = getEditorShortcutDefinition(id);
  const binding = def.bindings[0];
  if (!binding) return "";
  return formatShortcutBindingMenuLabel(binding, platform);
}
