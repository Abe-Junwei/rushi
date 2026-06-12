/** 编辑器快捷键真源：绑定定义、匹配、展示文案。每条组合最多 3 键（含修饰键 + 主键）。 */

export type EditorShortcutScope = "global" | "waveform";

export type EditorShortcutId =
  | "segment.mergeNext"
  | "segment.mergePrev"
  | "segment.splitPlayhead"
  | "segment.focusText"
  | "segment.delete"
  | "playback.toggle"
  | "edit.undo"
  | "edit.redo"
  | "workflow.save"
  | "workflow.confirmAdvance"
  | "workflow.find"
  | "workflow.closeFile"
  | "workflow.openSettings"
  | "workflow.segmentAnnotation"
  | "workflow.addCorrectionMemory"
  | "waveform.clearSelection"
  | "waveform.selectSegmentPrev"
  | "waveform.selectSegmentNext"
  | "waveform.seekFramePrev"
  | "waveform.seekFrameNext"
  | "waveform.zoomIn"
  | "waveform.zoomOut"
  | "waveform.lowConfidencePrev"
  | "waveform.lowConfidenceNext";

export type ShortcutBinding = {
  key: string;
  /** ⌘/Ctrl */
  mod?: boolean;
  /** Option / Alt */
  alt?: boolean;
  shift?: boolean;
  /** 覆盖 definition 级 allowInTextarea（如 Space 仅全局、⇧⌘Space 含正文） */
  allowInTextarea?: boolean;
};

export type EditorShortcutDefinition = {
  id: EditorShortcutId;
  bindings: ShortcutBinding[];
  keysLabel: string;
  footerAction?: string;
  panelAction: string;
  allowInTextarea?: boolean;
  /** 默认 global；waveform 仅波形 shell 有焦点时生效 */
  scope?: EditorShortcutScope;
  /** 默认 true；false 时无打开文件也可触发（如打开设置） */
  requiresOpenFile?: boolean;
};

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
 * - 合并 ⌘J/K · 拆分 ⌘D · 播放 Space / 正文 ⇧⌘Space（避开 macOS ⌘Space）
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
    bindings: [BINDING.plain(" "), BINDING.mod(" ", { shift: true, allowInTextarea: true })],
    keysLabel: "Space / ⇧⌘/Ctrl+Shift+Space",
    footerAction: "播放/暂停",
    panelAction: "播放或暂停；语段正文内请用 ⇧⌘Space（Space 会输入空格；勿用 ⌘Space，与 macOS 冲突）",
    allowInTextarea: false,
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
    id: "workflow.save",
    bindings: [BINDING.mod("s")],
    keysLabel: "⌘/Ctrl + S",
    footerAction: "保存语段",
    panelAction: "保存语段（不计入纠错记忆）",
    allowInTextarea: true,
  },
  {
    id: "workflow.confirmAdvance",
    bindings: [BINDING.mod("Enter")],
    keysLabel: "⌘/Ctrl + Enter",
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

function normalizeEventKey(e: Pick<KeyboardEvent, "key" | "code">): string {
  if (e.key === " " || e.code === "Space") return " ";
  if (e.key === "Backspace" || e.code === "Backspace") return "Backspace";
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
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

function bindingMatches(binding: ShortcutBinding, e: KeyboardEvent): boolean {
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
  if (!inTextarea) return true;
  return binding.allowInTextarea ?? def.allowInTextarea ?? false;
}

export function matchEditorShortcut(
  e: KeyboardEvent,
  opts?: { inTextarea?: boolean },
): EditorShortcutId | null {
  const inTextarea = opts?.inTextarea ?? false;
  for (const def of EDITOR_SHORTCUT_DEFINITIONS) {
    for (const binding of def.bindings) {
      if (!bindingAllowedInTextarea(binding, def, inTextarea)) continue;
      if (bindingMatches(binding, e)) return def.id;
    }
  }
  return null;
}

export function formatEditorShortcutPanelRows(): Array<{ keys: string; action: string }> {
  return EDITOR_SHORTCUT_DEFINITIONS.map((d) => ({
    keys: d.keysLabel,
    action: d.panelAction,
  }));
}

export type EditorShortcutPanelSection = {
  id: string;
  title: string;
  rows: Array<{ id: string; keys: string; action: string }>;
};

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
          keys: "Backspace / Delete（段界）",
          action: "行首 Backspace 与上一条合并；行尾 Delete 与下一条合并",
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

/** @deprecated 使用 registry 标签 */
export const SEGMENT_MERGE_NEXT_SHORTCUT_LABEL = getEditorShortcutDefinition("segment.mergeNext").keysLabel;
/** @deprecated 使用 registry 标签 */
export const SEGMENT_MERGE_PREV_SHORTCUT_LABEL = getEditorShortcutDefinition("segment.mergePrev").keysLabel;

export type SegmentMergeKeyboardIntent = "next" | "prev";

/** @deprecated 使用 matchEditorShortcut */
export function readSegmentMergeKeyboardIntent(
  e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
): SegmentMergeKeyboardIntent | null {
  const id = matchEditorShortcut(e as KeyboardEvent);
  if (id === "segment.mergeNext") return "next";
  if (id === "segment.mergePrev") return "prev";
  return null;
}
