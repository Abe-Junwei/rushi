# Intent：编辑器工作条（波形—语段 chrome）布局与信息层级

> **Research**：[`editor-workbench-toolbar-layout-research.md`](./editor-workbench-toolbar-layout-research.md)  
> **Plan**：[`editor-workbench-toolbar-layout-plan.md`](./editor-workbench-toolbar-layout-plan.md)  
> **Acceptance**：[`editor-workbench-toolbar-layout-acceptance.md`](./editor-workbench-toolbar-layout-acceptance.md)

## 目标

用户在改稿工作台 **30s 内** 能区分：播整段 / 播本段（浮层）/ 转录与编辑 / 缩放视图；窄窗（1280×800）下工作条关键控件不被裁切、popover 可用。

## 非目标

- Otter 式侧栏 player；恢复「波形底栏 + 语段顶栏」双条
- Descript 多轨/Blade/Slip；peaks/scroll 引擎改动
- 合并顶栏 `EditorToolbar` 与工作条

## 成功标准

见 acceptance 手测清单 + `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
