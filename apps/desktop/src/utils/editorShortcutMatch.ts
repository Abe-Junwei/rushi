import type {
  EditorShortcutDefinition,
  EditorShortcutId,
  ShortcutBinding,
  ShortcutBindingPlatform,
} from "./editorShortcutTypes";
import { EDITOR_SHORTCUT_DEFINITIONS } from "./editorShortcutDefinitions";

function normalizeEventKey(e: Pick<KeyboardEvent, "key" | "code">): string {
  if (e.key === " " || e.code === "Space") return " ";
  if (e.key === "Backspace" || e.code === "Backspace") return "Backspace";
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

function detectShortcutBindingPlatform(
  platform = typeof navigator !== "undefined" ? navigator.platform : "",
): ShortcutBindingPlatform {
  return /Mac|iPod|iPhone|iPad/.test(platform) ? "mac" : "win";
}

/** 单字母绑定在 macOS 正文内按 Option 时 `key` 常为特殊字符，须回退 `code`。 */
const LETTER_BINDING_CODES: Record<string, string> = {
  a: "KeyA",
  b: "KeyB",
  c: "KeyC",
  d: "KeyD",
  e: "KeyE",
  f: "KeyF",
  g: "KeyG",
  h: "KeyH",
  i: "KeyI",
  j: "KeyJ",
  k: "KeyK",
  l: "KeyL",
  m: "KeyM",
  n: "KeyN",
  o: "KeyO",
  p: "KeyP",
  q: "KeyQ",
  r: "KeyR",
  s: "KeyS",
  t: "KeyT",
  u: "KeyU",
  v: "KeyV",
  w: "KeyW",
  x: "KeyX",
  y: "KeyY",
  z: "KeyZ",
};

function eventKeyMatchesBinding(binding: ShortcutBinding, e: KeyboardEvent): boolean {
  const key = normalizeEventKey(e);
  if (key === binding.key || key.toLowerCase() === binding.key.toLowerCase()) return true;

  const bindingKeyLower = binding.key.toLowerCase();
  const letterCode = LETTER_BINDING_CODES[bindingKeyLower];
  if (!letterCode) return false;

  const hasModifier = binding.mod === true || binding.alt === true || binding.shift === true;
  return hasModifier && e.code === letterCode;
}

function bindingMatches(
  binding: ShortcutBinding,
  e: KeyboardEvent,
  platform: ShortcutBindingPlatform,
): boolean {
  if (binding.platform != null && binding.platform !== platform) return false;
  if (!eventKeyMatchesBinding(binding, e)) return false;
  const wantsMod = binding.mod === true;
  const wantsAlt = binding.alt === true;
  const wantsShift = binding.shift === true;
  const hasMod = e.metaKey || e.ctrlKey;

  if (wantsMod !== hasMod) return false;
  if (wantsAlt !== e.altKey) return false;
  if (wantsShift !== e.shiftKey) return false;

  if (wantsAlt && wantsMod) {
    const macCombo = e.metaKey && e.altKey && !e.ctrlKey;
    const winCombo = e.ctrlKey && e.altKey && !e.metaKey;
    if (!macCombo && !winCombo) return false;
  } else if (wantsAlt && !wantsMod) {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return false;
  } else if (wantsMod && !wantsAlt) {
    if (e.altKey) return false;
  }

  return true;
}

function bindingAllowedInTextarea(
  binding: ShortcutBinding,
  def: EditorShortcutDefinition,
  inTextarea: boolean,
): boolean {
  if (binding.textareaOnly && !inTextarea) return false;
  if (!inTextarea) return true;
  return binding.allowInTextarea ?? def.allowInTextarea ?? false;
}

export function matchEditorShortcut(
  e: KeyboardEvent,
  opts?: { inTextarea?: boolean; platform?: ShortcutBindingPlatform },
): EditorShortcutId | null {
  const inTextarea = opts?.inTextarea ?? false;
  const platform = opts?.platform ?? detectShortcutBindingPlatform();
  for (const def of EDITOR_SHORTCUT_DEFINITIONS) {
    for (const binding of def.bindings) {
      if (!bindingAllowedInTextarea(binding, def, inTextarea)) continue;
      if (bindingMatches(binding, e, platform)) return def.id;
    }
  }
  return null;
}
