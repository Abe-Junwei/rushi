# Plan：编辑器工作条布局（薄片 1–6）

> **Research**：[`editor-workbench-toolbar-layout-research.md`](./editor-workbench-toolbar-layout-research.md)  
> **Intent**：[`editor-workbench-toolbar-layout-intent.md`](./editor-workbench-toolbar-layout-intent.md)  
> **Acceptance**：[`editor-workbench-toolbar-layout-acceptance.md`](./editor-workbench-toolbar-layout-acceptance.md)

## 落位（已实现）

| 薄片 | 内容 | 主要文件 |
|------|------|----------|
| 1 | Primary 自动转录、转写 danger 停止、左/右 pill、32px 触控 | `EditorWorkbenchToolbar.tsx`、`EditorSegmentToolbarActions.tsx`、`waveform.css`、`editorSegmentToolbarStyles.ts` |
| 2 | 语段浮层仅 play/loop；倍速 global 真源 + legacy 迁移 | `WaveformSegmentPlaybackControls.tsx`、`useWaveformSegmentPlaybackControls.ts`、`waveformPrefs.ts` |
| 3 | 底栏三列 grid | `EditorStatusFooter.tsx`、`workspace.css` |
| 4 | `<1024px` 编辑/缩放 overflow 菜单 | `useWorkbenchToolbarCompact.ts`、`WorkbenchOverflowMenu.tsx`、`WaveformZoomBar.tsx` |
| 5 | 无音频 40px 居中编辑条 | `EditorWorkbenchToolbar --no-audio` |
| 6 | 工作条 40px；底栏快捷键 hint 8s 轮换 | `waveform.css`、`useEditorFooterShortcutHintRotation.ts` |

## 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

定向：`EditorWorkbenchToolbar.test.tsx`、`EditorSegmentToolbarActions.test.tsx`、`WaveformZoomBar.test.tsx`、`useWorkbenchToolbarCompact.test.ts`、`EditorStatusFooter.test.tsx`

## 文档

- [`DESIGN.md`](../../../DESIGN.md) §Waveform stage 已与实现对齐
