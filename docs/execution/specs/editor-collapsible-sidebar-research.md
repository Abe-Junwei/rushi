# 调研：编辑页可折叠 Workspace Sidebar

> **状态**：已采纳  
> **关联 spec**：`editor-collapsible-sidebar-intent.md` / `editor-collapsible-sidebar-acceptance.md`  
> **对照**：Jieyu `App.tsx` · `app-shell-layout.css` · `usePanelAutoCollapse.ts`

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 编辑页需要项目/文件导航侧栏，但应可折叠让出波形与语段宽度；Welcome/Hub 侧栏保持固定 |
| 本仓现状 | `WelcomeSidebar` 仅用于 Welcome/Hub（`WorkspaceShellLayout` 固定 `20rem`）；`EditorView` 无侧栏 |
| 成功标准 | Editor 可收/展侧栏、刷新持久化、点击主区空白收起；Welcome/Hub 无折叠控件 |

## 2. 业内成熟路线

| # | 路线 | 代表 | 核心机制 |
|---|------|------|----------|
| A | 解语 Side Pane | `Jieyu/src/App.tsx` | CSS 变量宽度 + 边缘 toggle + localStorage + 主区点击收起 |
| B | VS Code Activity Bar + Side Bar | VS Code | 固定 icon rail + 可隐藏 secondary sidebar |
| C | Notion | Notion | 全页侧栏 hover/按钮收起 |

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A 解语 Side Pane | **高** | toggle 语义、`usePanelAutoCollapse` 模式、持久化 key 分层 | Rushi 无 52px left rail，用 grid 第一列即可 |
| B VS Code | 低 | — | 需新 icon rail，超 scope |
| C Notion | 中 | 视觉 | 无现成实现 |

**本仓已有**：`WorkspaceShellLayout` · `WelcomeSidebar` · `shell.css` full-bleed purpose 标记

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 参数化 `WorkspaceShellLayout`（`collapsible` 仅 editor）；复用 `WelcomeSidebar` hubMode |
| 不做什么 | Welcome/Hub 不可折叠；v1 不做侧栏拖宽；不引入 icon rail |
| V1 必做 | 边缘 toggle + **点击主区空白收起** + localStorage |
| 落位 | `useWorkspaceSidebarCollapse` · `usePanelAutoCollapse` · `workspace.css` |
