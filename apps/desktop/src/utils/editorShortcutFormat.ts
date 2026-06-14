import { DIALOG_ESCAPE_KEYS_LABEL } from "./dialogPanelHints";
import type { EditorShortcutDefinition, EditorShortcutPanelSection } from "./editorShortcutTypes";
import { EDITOR_SHORTCUT_DEFINITIONS } from "./editorShortcutDefinitions";

function definitionPanelRow(def: EditorShortcutDefinition): {
  id: string;
  keys: string;
  action: string;
} {
  return { id: def.id, keys: def.keysLabel, action: def.panelAction };
}

/** 环境设置 · 编辑器快捷键面板：分组 + 完整说明（真源为 registry + 正文专用键）。 */
export function formatEditorShortcutPanelSections(): EditorShortcutPanelSection[] {
  const segmentDefs = EDITOR_SHORTCUT_DEFINITIONS.filter((d) => d.id.startsWith("segment."));
  const playbackDefs = EDITOR_SHORTCUT_DEFINITIONS.filter((d) => d.id.startsWith("playback."));
  const workflowDefs = EDITOR_SHORTCUT_DEFINITIONS.filter(
    (d) => d.id.startsWith("edit.") || d.id.startsWith("workflow."),
  );
  const waveformDefs = EDITOR_SHORTCUT_DEFINITIONS.filter((d) => d.scope === "waveform");

  return [
    {
      id: "transcript",
      title: "语段正文",
      rows: [
        {
          id: "segment-arrows",
          keys: "↑ / ↓",
          action: "切换到上一条 / 下一条语段，并联动播放（⇧+方向键仍用于扩选文字）",
        },
        {
          id: "segment-boundary-merge",
          keys: "Delete（段界）",
          action: "行尾 Delete 与下一条合并",
        },
        ...segmentDefs.map(definitionPanelRow),
      ],
    },
    {
      id: "playback",
      title: "播放",
      rows: playbackDefs.map(definitionPanelRow),
    },
    {
      id: "workflow",
      title: "编辑与工作流",
      rows: workflowDefs.map(definitionPanelRow),
    },
    {
      id: "waveform",
      title: "波形区（波形区域有焦点时）",
      rows: waveformDefs.map(definitionPanelRow),
    },
    {
      id: "other",
      title: "其它",
      rows: [
        {
          id: "dialog-escape",
          keys: DIALOG_ESCAPE_KEYS_LABEL,
          action: "关闭最上层的浮动面板或确认对话框（处理中时不关闭）",
        },
        {
          id: "autosave",
          keys: "停笔约 2s",
          action: "自动保存语段（仅落库，不计入纠错记忆）",
        },
        {
          id: "highlight-word",
          keys: "点击高亮词",
          action: "查看改正建议并一键替换",
        },
      ],
    },
  ];
}

export function editorShortcutFooterHints(): Array<{ keys: string; footerAction: string }> {
  return EDITOR_SHORTCUT_DEFINITIONS.filter((d) => d.footerAction).map((d) => ({
    keys: d.keysLabel,
    footerAction: d.footerAction!,
  }));
}
