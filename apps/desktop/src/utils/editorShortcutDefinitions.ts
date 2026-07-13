import type { EditorShortcutDefinition, EditorShortcutId, ShortcutBinding } from "./editorShortcutTypes";

export const EDITOR_SHORTCUT_MAX_KEYS = 3;

const BINDING = {
  mod: (key: string, opts?: Partial<Omit<ShortcutBinding, "key">>): ShortcutBinding => ({
    key,
    mod: true,
    ...opts,
  }),
  plain: (key: string, opts?: Partial<Omit<ShortcutBinding, "key">>): ShortcutBinding => ({
    key,
    ...opts,
  }),
} as const;

/** 统计组合键数量（主键 + 修饰键）。 */
export function countShortcutBindingKeys(binding: ShortcutBinding): number {
  let n = 1;
  if (binding.mod) n += 1;
  if (binding.alt) n += 1;
  if (binding.shift) n += 1;
  return n;
}

function assertBindingsWithinKeyLimit(definitions: EditorShortcutDefinition[]): void {
  for (const def of definitions) {
    for (const binding of def.bindings) {
      const count = countShortcutBindingKeys(binding);
      if (count > EDITOR_SHORTCUT_MAX_KEYS) {
        throw new Error(
          `shortcut ${def.id} exceeds ${EDITOR_SHORTCUT_MAX_KEYS}-key limit (${count}): ${JSON.stringify(binding)}`,
        );
      }
    }
  }
}

/**
 * 默认绑定（优先 2 键）：
 * - 合并 ⌘J/K · 拆分 ⌘D · 播放：正文外 Space；正文内 ⇧Space（裸 Space 输入空格）
 * - 语段正文切换 ↑↓（见 legacy hints）；波形区 ←→
 * - 波形区专用键 scope=waveform
 */
export const EDITOR_SHORTCUT_DEFINITIONS: EditorShortcutDefinition[] = [
  {
    id: "segment.mergeNext",
    bindings: [BINDING.mod("j")],
    keysLabel: "⌘/Ctrl + J",
    footerAction: "与下一条合并",
    panelAction: "与下一条语段合并；连续多选时为批量合并",
    allowInTextarea: true,
  },
  {
    id: "segment.mergePrev",
    bindings: [BINDING.mod("k")],
    keysLabel: "⌘/Ctrl + K",
    footerAction: "与上一条合并",
    panelAction: "与上一条语段合并",
    allowInTextarea: true,
  },
  {
    id: "segment.advancePrev",
    bindings: [BINDING.plain("ArrowUp")],
    keysLabel: "↑",
    footerAction: "上一条语段",
    panelAction: "选中上一条语段（语段正文内由正文键处理；失焦时全局生效）",
    allowInTextarea: false,
  },
  {
    id: "segment.advanceNext",
    bindings: [BINDING.plain("ArrowDown")],
    keysLabel: "↓",
    footerAction: "下一条语段",
    panelAction: "选中下一条语段（语段正文内由正文键处理；失焦时全局生效）",
    allowInTextarea: false,
  },
  {
    id: "segment.splitPlayhead",
    bindings: [BINDING.mod("d")],
    keysLabel: "⌘/Ctrl + D",
    footerAction: "在播放头拆分",
    panelAction: "在当前播放头位置拆分语段",
    allowInTextarea: true,
  },
  {
    id: "segment.focusText",
    bindings: [BINDING.mod("e")],
    keysLabel: "⌘/Ctrl + E",
    footerAction: "聚焦语段正文",
    panelAction: "聚焦当前语段正文输入框",
    allowInTextarea: false,
  },
  {
    id: "segment.delete",
    bindings: [BINDING.mod("Backspace")],
    keysLabel: "⌘/Ctrl + Backspace",
    footerAction: "删除语段",
    panelAction: "删除选中语段（多选时为批量删除）",
    allowInTextarea: true,
  },
  {
    id: "playback.toggle",
    // Dual binding (global-vs-segment UX research): bare Space outside transcript
    // edit targets; Shift+Space inside so Space still types a space in CM6/textarea.
    bindings: [
      BINDING.plain(" ", { allowInTextarea: false }),
      BINDING.plain(" ", { shift: true, allowInTextarea: true }),
    ],
    keysLabel: "Space / Shift + Space",
    footerAction: "播放/暂停",
    panelAction:
      "会话粘性播放或暂停（正文外 Space；正文内 ⇧Space）。无会话且有选中语段时起播=段播；已在全局通读会话中则暂停后再 Space 从停点续通读。语段会话=续播/重播该句。工具条「全局播放」可进入/退出语段会话。旁侧/浮层亦可开段播",
    allowInTextarea: true,
  },
  {
    id: "edit.undo",
    bindings: [BINDING.mod("z")],
    keysLabel: "⌘/Ctrl + Z",
    panelAction: "撤销",
    allowInTextarea: true,
  },
  {
    id: "edit.redo",
    bindings: [BINDING.mod("z", { shift: true })],
    keysLabel: "⇧⌘/Ctrl+Shift + Z",
    panelAction: "重做",
    allowInTextarea: true,
  },
  {
    id: "edit.copy",
    // textareaOnly: only transcript body — do not steal ⌘C from other inputs.
    bindings: [BINDING.mod("c", { allowInTextarea: true, textareaOnly: true })],
    keysLabel: "⌘/Ctrl + C",
    footerAction: "复制",
    panelAction: "复制语段正文选区（无选区时复制当前行）",
    allowInTextarea: true,
  },
  {
    id: "edit.cut",
    bindings: [BINDING.mod("x", { allowInTextarea: true, textareaOnly: true })],
    keysLabel: "⌘/Ctrl + X",
    footerAction: "剪切",
    panelAction: "剪切语段正文选区（无选区时剪切当前行文本，不拆段）",
    allowInTextarea: true,
  },
  {
    id: "edit.paste",
    bindings: [BINDING.mod("v", { allowInTextarea: true, textareaOnly: true })],
    keysLabel: "⌘/Ctrl + V",
    footerAction: "粘贴",
    panelAction: "粘贴到语段正文（多行保留为段内换行，不拆段）",
    allowInTextarea: true,
  },
  {
    id: "workflow.save",
    bindings: [BINDING.mod("s")],
    keysLabel: "⌘/Ctrl + S",
    footerAction: "保存语段",
    panelAction: "保存语段（不计入纠错记忆）",
    allowInTextarea: true,
  },
  {
    id: "workflow.advanceSegment",
    bindings: [BINDING.plain("Tab", { allowInTextarea: true, textareaOnly: true })],
    keysLabel: "Tab",
    footerAction: "跳下一条语段",
    panelAction: "跳到下一语段（不定稿；语段正文内生效）",
    allowInTextarea: true,
  },
  {
    id: "workflow.confirmAdvance",
    bindings: [BINDING.plain("Enter", { allowInTextarea: true, textareaOnly: true })],
    keysLabel: "Enter",
    footerAction: "定稿并跳下一条",
    panelAction: "定稿：落库（有未保存改词时写入纠错记忆）并跳到下一语段",
    allowInTextarea: true,
  },
  {
    id: "workflow.find",
    bindings: [BINDING.mod("f")],
    keysLabel: "⌘/Ctrl + F",
    footerAction: "查找与替换",
    panelAction: "查找与替换",
    allowInTextarea: true,
  },
  {
    id: "workflow.closeFile",
    bindings: [BINDING.mod("e", { shift: true })],
    keysLabel: "⇧⌘/Ctrl+Shift + E",
    panelAction: "关闭当前文件（返回文件列表）",
    allowInTextarea: true,
  },
  {
    id: "workflow.openSettings",
    bindings: [BINDING.mod(",")],
    keysLabel: "⌘/Ctrl + ,",
    footerAction: "打开设置",
    panelAction: "打开环境与快捷键设置面板",
    allowInTextarea: true,
    requiresOpenFile: false,
  },
  {
    id: "workflow.openActivityInbox",
    bindings: [BINDING.mod("n", { shift: true })],
    keysLabel: "⇧⌘/Ctrl+Shift + N",
    footerAction: "活动与提醒",
    panelAction: "打开活动与提醒收件箱",
    allowInTextarea: true,
    requiresOpenFile: false,
  },
  {
    id: "workflow.segmentAnnotation",
    bindings: [BINDING.mod("n")],
    keysLabel: "⌘/Ctrl + N",
    footerAction: "添加/编辑备注",
    panelAction: "为当前语段添加或编辑备注",
    allowInTextarea: true,
  },
  {
    id: "workflow.addCorrectionMemory",
    bindings: [BINDING.mod("l")],
    keysLabel: "⌘/Ctrl + L",
    footerAction: "纳入更正记忆",
    panelAction: "将正文选区纳入更正记忆（需先选中文字）",
    allowInTextarea: true,
  },
  {
    id: "waveform.clearSelection",
    bindings: [BINDING.plain("Escape")],
    keysLabel: "Esc",
    panelAction: "（波形区）清除多选或取消焦点",
    scope: "waveform",
  },
  {
    id: "waveform.selectSegmentPrev",
    bindings: [BINDING.plain("ArrowLeft")],
    keysLabel: "←（⇧ 扩选）",
    panelAction: "（波形区）选中上一条语段",
    scope: "waveform",
  },
  {
    id: "waveform.selectSegmentNext",
    bindings: [BINDING.plain("ArrowRight")],
    keysLabel: "→（⇧ 扩选）",
    panelAction: "（波形区）选中下一条语段",
    scope: "waveform",
  },
  {
    id: "waveform.seekFramePrev",
    bindings: [BINDING.plain(",")],
    keysLabel: ",",
    panelAction: "（波形区）播放头后退一帧",
    scope: "waveform",
  },
  {
    id: "waveform.seekFrameNext",
    bindings: [BINDING.plain(".")],
    keysLabel: ".",
    panelAction: "（波形区）播放头前进一帧",
    scope: "waveform",
  },
  {
    id: "waveform.zoomIn",
    bindings: [BINDING.plain("="), BINDING.plain("+"), BINDING.mod("="), BINDING.mod("+")],
    keysLabel: "+ / ⌘+",
    panelAction: "（波形区）放大时间轴",
    scope: "waveform",
  },
  {
    id: "waveform.zoomOut",
    bindings: [BINDING.plain("-"), BINDING.mod("-")],
    keysLabel: "- / ⌘-",
    panelAction: "（波形区）缩小时间轴",
    scope: "waveform",
  },
  {
    id: "waveform.lowConfidencePrev",
    bindings: [BINDING.plain("[")],
    keysLabel: "[",
    panelAction: "（波形区）跳转到上一条低置信度语段",
    scope: "waveform",
  },
  {
    id: "waveform.lowConfidenceNext",
    bindings: [BINDING.plain("]")],
    keysLabel: "]",
    panelAction: "（波形区）跳转到下一条低置信度语段",
    scope: "waveform",
  },
];

assertBindingsWithinKeyLimit(EDITOR_SHORTCUT_DEFINITIONS);

const DEFINITION_BY_ID = new Map(EDITOR_SHORTCUT_DEFINITIONS.map((d) => [d.id, d]));

export function getEditorShortcutDefinition(id: EditorShortcutId): EditorShortcutDefinition {
  const def = DEFINITION_BY_ID.get(id);
  if (!def) throw new Error(`unknown shortcut: ${id}`);
  return def;
}
