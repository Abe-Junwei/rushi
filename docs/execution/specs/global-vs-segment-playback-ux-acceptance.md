# Acceptance：全局播放 vs 语段播放（产品入口恢复）

> **Research**：[global-vs-segment-playback-ux-research.md](./global-vs-segment-playback-ux-research.md)  
> **Plan**：[global-vs-segment-playback-ux-plan.md](./global-vs-segment-playback-ux-plan.md)  
> **状态**：自动化 ✅；手测待签

## 能力—UI 状态矩阵

| 能力 | 条件 | UI / 快捷键 | 期望 |
|------|------|-------------|------|
| 全局播放 | 有音频且 ready | 工作条主钮；Space；正文 ⇧⌘Space | 从 playhead 续播至 EOF / 暂停；无选中也可播 |
| 全局暂停 | 媒体 playing | 同上 | pause；清除语段 bound（既有 `togglePlay`） |
| 全局倍速 | ready | 工作条倍速菜单 | 唯一真源 |
| 语段播放 | 有选中语段 | 波形浮层 play | scoped；段尾停 |
| 语段 loop | 有选中 | 浮层 loop | 既有 |
| 主钮禁用 | busy 或 !ready | 工作条主钮 | disabled；**不**因无选中禁用 |

## 自动化

- [x] `executeEditorShortcut.test.ts` — Space → `togglePlay`；无选中仍可 toggle
- [x] `useEditorShortcutDispatcher.test.ts` — Space / ⇧⌘Space → `togglePlay`
- [x] `EditorWorkbenchToolbar.test.tsx` — 无选中主钮仍可用；点击走 `togglePlay`
- [x] `editorShortcutRegistry.test.ts` — panel 文案含全局语义

## 手测

1. [ ] 打开有音频文件、不选语段：Space 从播放头连续播
2. [ ] 选中语段：浮层 play 段尾停；Space 仍为全局（可越过段尾）
3. [ ] 全局播放中点浮层 play：进入 scoped；再 Space：恢复全局续播
4. [ ] 正文焦点：⇧⌘Space 全局播；裸 Space 输入空格
