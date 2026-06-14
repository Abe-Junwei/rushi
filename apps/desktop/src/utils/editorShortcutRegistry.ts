/** 编辑器快捷键真源：绑定定义、匹配、展示文案。每条组合最多 3 键（含修饰键 + 主键）。 */

export type {
  EditorShortcutDefinition,
  EditorShortcutId,
  EditorShortcutPanelSection,
  EditorShortcutScope,
  SegmentMergeKeyboardIntent,
  ShortcutBinding,
} from "./editorShortcutTypes";

export {
  EDITOR_SHORTCUT_DEFINITIONS,
  EDITOR_SHORTCUT_MAX_KEYS,
  countShortcutBindingKeys,
  getEditorShortcutDefinition,
} from "./editorShortcutDefinitions";

export { matchEditorShortcut } from "./editorShortcutMatch";

export {
  editorShortcutFooterHints,
  formatEditorShortcutPanelSections,
} from "./editorShortcutFormat";
