# Acceptance：编辑器工作条布局

> **Research**：[`editor-workbench-toolbar-layout-research.md`](./editor-workbench-toolbar-layout-research.md)  
> **Plan**：[`editor-workbench-toolbar-layout-plan.md`](./editor-workbench-toolbar-layout-plan.md)

> **状态**：手测 ✅（2026-06-07）；自动化见下表

## 能力—UI 矩阵

| 区域 | 能力 | UI |
|------|------|-----|
| 左 | 全局播放/暂停 | 32px 圆钮 + 时间在 pill 内 |
| 左 | 倍速 | 工作条 global menu（唯一真源） |
| 左 | 滚屏跟随 | segment control |
| 中 | 空稿 | 「自动转录」Primary（saffron） |
| 中 | 有稿 | 四项 ghost 等权 |
| 中 | 转写中 | 仅 danger「停止转写」 |
| 右 | 缩放 | fit 语段/整段、±、重置、minimap；窄窗「缩放 ▾」+ 保留 ± |
| 浮层 | 语段播放 | play + loop（无独立倍速） |
| 无音频 | 编辑 | 40px 单行居中，无空 transport/zoom 列 |
| 底栏 | 状态 | 三列 grid；无状态时快捷键 hint 8s 轮换 |

## 手测清单

1. [x] 空文件 + 有音频：「自动转录」为 Primary
2. [x] 已有语段：「自动转录」为 ghost，与规则纠错/智能改稿/查找替换同级
3. [x] 转写进行中：中间仅「停止转写」
4. [x] 左播放簇、右缩放簇：浅底 pill 分组
5. [x] 窗口 &lt;1024px：中间「编辑 ▾」；zoom ± 仍可见
6. [x] 无音频文件：仅居中编辑条，无空 transport/zoom
7. [x] 1280×800：关键按钮未裁切；编辑/缩放 popover 可用
8. [x] 语段浮层：仅 play/loop；倍速与工作条 global 一致

## 自动化

- [x] `EditorWorkbenchToolbar.test.tsx`
- [x] `EditorSegmentToolbarActions.test.tsx`
- [x] `WaveformZoomBar.test.tsx`
- [x] `useWorkbenchToolbarCompact.test.ts`
- [x] `EditorStatusFooter.test.tsx`
- [x] `useEditorFooterShortcutHintRotation.test.ts`
- [x] `waveformPrefs.test.ts`（segment rate → global 迁移）

## 已知后续（非本 acceptance 阻塞）

- Primary 条件可扩展为「有语段但全文空」— 产品可选
- 中间编辑区 pill 包裹 — 视觉 polish，research 未硬性要求
