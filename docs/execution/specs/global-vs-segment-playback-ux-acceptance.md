# Acceptance：全局播放 vs 语段播放（产品入口恢复）

> **Research**：[global-vs-segment-playback-ux-research.md](./global-vs-segment-playback-ux-research.md)  
> **Plan**：[global-vs-segment-playback-ux-plan.md](./global-vs-segment-playback-ux-plan.md)  
> **状态**：自动化 ✅；手测 ✅（2026-07-12）

## 能力—UI 状态矩阵

| 能力 | 条件 | UI / 快捷键 | 期望 |
|------|------|-------------|------|
| 全局播放 | 有音频且 ready | 工作条「全局」 | 从 playhead 续播至 EOF / 暂停；无选中也可播 |
| Space 会话粘性播放 | 有音频且 ready | 正文外 Space；正文内 ⇧Space | playing → pause 并保留会话；idle/global + 有选中 → 段播；无选中 → 全局；段尾后 → 重播该句 |
| 全局暂停 | 全局媒体 playing | 工作条「全局」 | pause；清除语段 bound，记录全局会话 |
| 全局倍速 | ready | 工作条倍速菜单 | 唯一真源 |
| 语段播放 | 有选中语段 | 波形浮层 play | scoped；段尾停 |
| 语段 loop | 有选中 | 浮层 loop | 既有 |
| 主钮禁用 | busy 或 !ready | 工作条主钮 | disabled；**不**因无选中禁用 |

## 自动化

- [x] `executeEditorShortcut.test.ts` — Space/⇧Space → `togglePlay`；无选中仍可 toggle
- [x] `useEditorShortcutDispatcher.test.ts` — 正文外 Space → `togglePlay`；正文内 ⇧Space → `togglePlay`；正文内裸 Space / ⇧⌘Space 不播
- [x] `EditorWorkbenchToolbar.test.tsx` — 无选中主钮仍可用；点击走 `toggleGlobalPlay`
- [x] `editorShortcutRegistry.test.ts` — panel 文案含 Space / Shift + Space

## 手测

1. [x] 打开有音频文件、不选语段：正文外 Space 从播放头连续播
2. [x] 选中语段：浮层 play 段尾停；Space 仍为会话粘性
3. [x] 全局播放中点浮层 play：进入 scoped；再 Space：按会话粘性规则
4. [x] 正文焦点：⇧Space 播；裸 Space 输入空格
