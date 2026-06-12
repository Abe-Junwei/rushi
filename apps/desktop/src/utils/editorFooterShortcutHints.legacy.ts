export type EditorFooterShortcutHint = {
  id: string;
  keys: string;
  footerAction: string;
  panelAction: string;
};

/** 工作流类快捷键（不含语段结构操作，后者见 editorShortcutRegistry）。 */
export const EDITOR_FOOTER_SHORTCUT_HINTS: EditorFooterShortcutHint[] = [
  {
    id: "autosave",
    keys: "停笔约 2s",
    footerAction: "自动保存语段",
    panelAction: "自动保存语段（仅落库，不计入纠错记忆）",
  },
  {
    id: "segment-arrows",
    keys: "↑ / ↓",
    footerAction: "语段间切换并联动播放",
    panelAction: "在语段正文内：↑ 上一条 / ↓ 下一条，并联动播放",
  },
  {
    id: "highlight-word",
    keys: "点击高亮词",
    footerAction: "查看改正建议并替换",
    panelAction: "查看改正建议并一键替换",
  },
];

export function formatEditorFooterShortcutHint(hint: EditorFooterShortcutHint): string {
  return `${hint.keys} · ${hint.footerAction}`;
}

export const EDITOR_FOOTER_SHORTCUT_HINT_ROTATION_MS = 8000;
