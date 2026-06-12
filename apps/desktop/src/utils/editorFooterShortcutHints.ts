import {
  EDITOR_FOOTER_SHORTCUT_HINTS as LEGACY_FOOTER_HINTS,
  type EditorFooterShortcutHint,
  formatEditorFooterShortcutHint,
  EDITOR_FOOTER_SHORTCUT_HINT_ROTATION_MS,
} from "./editorFooterShortcutHints.legacy";
import { editorShortcutFooterHints } from "./editorShortcutRegistry";

export type { EditorFooterShortcutHint };
export { formatEditorFooterShortcutHint, EDITOR_FOOTER_SHORTCUT_HINT_ROTATION_MS };

/** 底栏轮换：legacy 工作流提示 + registry 语段快捷键。 */
export const EDITOR_FOOTER_SHORTCUT_HINTS: EditorFooterShortcutHint[] = [
  ...LEGACY_FOOTER_HINTS,
  ...editorShortcutFooterHints().map((h, i) => ({
    id: `registry-${i}`,
    keys: h.keys,
    footerAction: h.footerAction,
    panelAction: h.footerAction,
  })),
];
