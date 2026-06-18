# Spec(intent): Welcome 搜索 — 文件 vs 内容

> **Research brief**：[`welcome-search-research.md`](./welcome-search-research.md)  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 · v1.2 候选

## 目标

在 Welcome 顶栏提供 **可区分、可切换** 的两种搜索：

1. **找文件** — 按项目名、文件名、场次元信息（讲述人 / 时间 / 地点 / 主题 / 转录人）检索，帮助用户定位 **Project / File**。
2. **找内容** — 跨全部本地项目检索 **语段正文**（`segments.text`），帮助用户定位 **Segment**，并跳入 Editor 高亮命中。

用户在任何时刻应能一眼看出当前是哪种模式；两种模式的占位符、结果行样式、跳转行为 **不得混用**。

## 切片划分（单人 2–4h/片）

| Step | ID | 范围 | 交付 |
|------|-----|------|------|
| **1** | **WS-1** | Rust 文件搜索 command + 单测 | `welcome_search_files` 可 invoke |
| **2** | **WS-2** | Welcome UI 文件模式 | 顶栏可输入；分段「文件」；结果列表；跳转 Hub |
| **3** | **WS-3** | FTS migration + 内容搜索 command | `segments_fts` + `welcome_search_content` |
| **4** | **WS-4** | Welcome UI 内容模式 + Editor 衔接 | 「内容」模式；打开文件并定位语段 + snippet 高亮 |
| **5** | **WS-5** | 收尾 | 空态 / 防抖 / localStorage 记住模式；H-WS 手测 |

## 边界（不做）

- 不替代 Editor 内 Find/Replace（单文件替换仍走 `useFindReplaceSearch`）。
- 不搜索术语库、编辑日志、音频文件名（磁盘 path）。
- 不做跨模式「智能合并」排序。
- 不与 BATCH / DELIV / CSP 同 PR。

## 验证方式

- 每片：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- Rust：`cargo test welcome_search`（或 workspace 等价命令）
- 收官：H-WS-1～6 手测（见 acceptance）
