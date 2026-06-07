export type EditorFooterShortcutHint = {
  id: string;
  keys: string;
  /** 底栏轮换：单行紧凑文案 */
  footerAction: string;
  /** 设置页表格：完整说明 */
  panelAction: string;
};

/** 底栏轮换与设置页「编辑器快捷键」共用真源。 */
export const EDITOR_FOOTER_SHORTCUT_HINTS: EditorFooterShortcutHint[] = [
  {
    id: "confirm-edit",
    keys: "⌘/Ctrl + Enter",
    footerAction: "定稿并跳下一条",
    panelAction: "定稿：落库（有未保存改词时写入纠错记忆）并跳到下一语段",
  },
  {
    id: "save",
    keys: "⌘/Ctrl + S",
    footerAction: "保存语段",
    panelAction: "保存语段（不计入纠错记忆）",
  },
  {
    id: "autosave",
    keys: "停笔约 2s",
    footerAction: "自动保存语段",
    panelAction: "自动保存语段（仅落库，不计入纠错记忆）",
  },
  {
    id: "find-replace",
    keys: "⌘/Ctrl + F",
    footerAction: "查找与替换",
    panelAction: "查找与替换",
  },
  {
    id: "segment-tab",
    keys: "Tab / Shift+Tab",
    footerAction: "语段间切换并联动播放",
    panelAction: "在语段间前进 / 后退并联动播放",
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
