# Batch 7 — Editor UI 与编排

## 范围

- `ProjectPanel.tsx` — 薄编排，健康（AI_QUICKSTART）
- `EditorView.tsx` — **762 行**，工具栏+列表+波形+空态 — R7-001
- `WelcomeView` / `WelcomeSidebar` — 2025 P4 部分可能已改（Escape 删除确认已有）

## 面板 CSS

- 抽查 `EditorView`：需人工对照两层 border 规则（未全量 grep border）

## 多文件 UI

- `EditorView` 已用 `currentFileId` 切换文件 — OK
- 转写/导出仍 project 级 — 见 R2/R5

## a11y

- 2025：hover-only 操作按钮 — 待 UI 走查，未记新 ID
