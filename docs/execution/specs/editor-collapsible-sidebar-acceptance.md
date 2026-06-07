# 编辑页可折叠 Sidebar — 验收

> **Research**：[`editor-collapsible-sidebar-research.md`](./editor-collapsible-sidebar-research.md)

## Must

| ID | 场景 | 预期 |
|----|------|------|
| A | Welcome / Hub | 侧栏固定 20rem，无折叠钮 |
| B | Editor 打开文件 | 侧栏显示 Hub 同款项目/文件导航，当前文件高亮 |
| C | Editor 点 `‹` | 侧栏收至 0，主区变宽；`›` 展开 |
| D | Editor 点击主区空白 | 侧栏自动收起 |
| E | Editor 刷新 | 折叠态按 `rushi.editor-workspace-sidebar-collapsed` 恢复 |

## Should

| ID | 场景 | 预期 |
|----|------|------|
| F | 折叠态编辑 | 语段/波形交互正常 |
| G | a11y | toggle `aria-expanded` / `aria-label` 正确 |

## Won't (v1)

- 侧栏拖宽
- Welcome/Hub 折叠
