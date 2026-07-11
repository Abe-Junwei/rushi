# Plan：全局播放 vs 语段播放（产品入口恢复）

> **Research**：[global-vs-segment-playback-ux-research.md](./global-vs-segment-playback-ux-research.md)  
> **Intent**：[global-vs-segment-playback-ux-intent.md](./global-vs-segment-playback-ux-intent.md)  
> **Acceptance**：[global-vs-segment-playback-ux-acceptance.md](./global-vs-segment-playback-ux-acceptance.md)

## 步骤

1. **工具条**：`EditorWorkbenchToolbar` 主钮 → `tx.togglePlay`；图标态用 `tx.isPlaying`；禁用条件 = `busy || !isReady`（不再依赖选中语段）。
2. **快捷键**：`executeEditorShortcut` 的 `playback.toggle` → `wf.togglePlay()`（有 `mediaUrl` 即可；不查选中索引）。更新 `editorShortcutDefinitions` footer/panel 文案为全局播放。
3. **文档**：`desktop-waveform-engine.md` Space/工具栏改回全局；research 签收；toolbar acceptance 矩阵保持「全局播放」真意。
4. **测试**：翻转 `executeEditorShortcut` / `useEditorShortcutDispatcher` / `EditorWorkbenchToolbar` 中「Space=语段」断言；浮层段播路径与 H3 单测保留在 segment controls。

## 验证命令

```bash
npm run typecheck --workspace=apps/desktop
npx vitest run apps/desktop/src/utils/executeEditorShortcut.test.ts \
  apps/desktop/src/hooks/useEditorShortcutDispatcher.test.ts \
  apps/desktop/src/components/editor/EditorWorkbenchToolbar.test.tsx \
  apps/desktop/src/utils/editorShortcutRegistry.test.ts
```
