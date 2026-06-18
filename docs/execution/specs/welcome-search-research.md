# 调研：Welcome 搜索 — 文件 vs 内容双模式

> **状态**：规划门禁（2026-06-18）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 Welcome 搜索 · §10.5 v1.2 候选  
> **关联 spec**：`welcome-search-{intent,plan,acceptance}.md`  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 口述史 / 访谈工作者在 **Welcome** 已离开 Editor，需快速找回「哪个项目 / 哪个文件」或「哪段话里提到过某个词」。当前顶栏搜索框为 **只读占位**（`placeholder="搜索转写内容..."`），无法输入，且文案暗示仅「内容」检索，与「找文件」需求混淆。 |
| **本仓现状** | `WelcomeTopBar.tsx`：`readOnly` input，无查询 API。Editor 内 **单文件** 查找替换：`useFindReplaceSearch` + `collectLiteralFindMatches`（[`segmentFindReplace.ts`](../../../apps/desktop/src/services/editor/segmentFindReplace.ts)），**不跨文件**。数据真源：SQLite `projects` / `files` / `segments`（[`db/schema.rs`](../../../apps/desktop/src-tauri/src/db/schema.rs)）；项目元信息 P0 五列已入库（`narrator`、`recorded_at`、`location`、`subject`、`transcriber`）。最近文件：`listRecentWorkspaceFiles` 仅按 `updated_at_ms` 取前 8 条，**无关键词**。全仓 **无 FTS5** 索引。 |
| **成功标准** | Welcome 顶栏可输入；用户可 **显式切换**「找文件 / 找内容」两种模式；各模式结果列表语义清晰、可一键跳转（文件 → Hub 或 Editor；内容 → 打开文件并定位语段）；`typecheck` + 定向 Rust/TS test + H-WS-* 手测签收。 |

### 1.1 模式定义（产品硬约束）

| 模式 | 用户意图 | 检索对象 | 典型查询 |
|------|----------|----------|----------|
| **找文件** | 我记得项目名 / 文件名 / 场次信息 | `projects.name`、P0 元信息、`files.name` | 「张三访谈」「2024-03」「场次 A」 |
| **找内容** | 我记得转写正文里出现过某词 | `segments.text`（跨项目、跨文件） | 「抗美援朝」「那个村子」 |

**禁止** v1 将两类命中混排在同一列表且无模式标识（避免「文件行 vs 语段行」认知负担）。

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表 | 核心机制 | 可验证链接 |
|---|------|------|----------|------------|
| A | **双入口 / 双模式** | VS Code（`Ctrl+P` 文件 vs `Ctrl+Shift+F` 全文）、macOS Finder 文件名 vs Spotlight「文稿与数据」 | 模式在 UI 上 **先选后搜** 或独立快捷键；结果类型单一 | [VS Code 用户指南 — Search](https://code.visualstudio.com/docs/editor/codebasics#_search-across-files) |
| B | **统一框 + 过滤器** | Notion Quick Find、Obsidian Search | 单输入框；filter chip（`file:`、`path:`、`tag:`）或侧边 Tab | [Obsidian Search](https://help.obsidian.md/plugins/search) |
| C | **项目内搜索** | Descript、Otter | 搜索范围默认 **当前项目**；跨项目弱或付费 | 产品内 Search（无公开 schema） |
| D | **本地全文索引** | Zotero、Logseq、Bear（历史） | SQLite FTS5 / 自建倒排；增量维护 | [SQLite FTS5](https://www.sqlite.org/fts5.html) |
| E | **按需扫描** | 小工具型 SQLite 应用 | `LIKE '%q%'` + `LIMIT`；语料小可接受 | 本仓 Editor `indexOf` 先例 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 | 进度 / 内存 |
|------|--------|----------|-------------------|-------------|
| A 双模式 | **高** | 顶栏 segmented control；模式与结果一一对应 | 需多占顶栏横向空间（可接受） | 无索引成本 |
| B 统一框+filter | 中 | 单输入 DOM | 口述史用户不熟悉 `file:` 操作符；**与「区分」诉求略背离** | 低 |
| C 项目内 only | 低 | — | Welcome 场景需 **跨项目** | — |
| D FTS5 | **高** | Rust `rusqlite` 已用；migration 模式成熟 | 须 migration + segment 写路径触发器；**禁止第二套 segment 真源** | 建索引一次性；增量 O(段) |
| E LIKE 扫描 | 中 | 零 migration | 语段 10⁵+ 时延迟与 UI 卡顿 | 峰值读全表 |

**本仓可复用（必须先列再扩展）**

| 模块 | 用途 |
|------|------|
| `project_list` / `list_files` / `project_load` | 文件模式结果补全、跳转前校验 |
| `collectLiteralFindMatches` + `buildFindMatchListItems` | 内容 snippet 高亮与语段时间标签 |
| `resolveEditorResumeTarget` / `writeLastWorkspace` | 打开文件后恢复 Editor |
| `selectSegmentAt` + `scheduleScrollSegmentListIndexToView` | 内容命中后定位语段 |
| `compactDialog` / `controlStyles` | 结果浮层 Notion Zen 气质 |
| `project-hub-metadata` 五列 | 文件模式元信息命中 |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **A（双模式 UI）+ D（内容 FTS5）+ SQL LIKE（文件模式）** |
| **找文件** | 单条 Rust command：`welcome_search_files` — `JOIN projects ⟕ files`，`LIKE` + `COLLATE NOCASE` 匹配 `projects.name`、五列元信息、`files.name`；按 `updated_at_ms` 排序；默认 `LIMIT 30` |
| **找内容** | migration 建 `segments_fts`（FTS5，`content='segments'`，`tokenize='unicode61'`）+ insert/update/delete 触发器；command：`welcome_search_content` — FTS `MATCH` + join 回 `files`/`projects`；snippet 截取；`LIMIT 40` |
| **UI** | `WelcomeTopBar`：去 `readOnly`；输入框左侧或下方 **分段切换「文件 \| 内容」**；下方 `WelcomeSearchResults` 浮层（`role="listbox"`）；placeholder 随模式变 |
| **跳转** | 文件命中 → `loadProject` + Hub（`closeFile`）并 scroll/highlight 文件行；可选主按钮「打开」进 Editor。内容命中 → `loadProject` + `openFile` + `selectSegmentAt(idx)` + 传入 `pendingFindRange` 供 Editor 高亮（复用 find 片段 UI，**不**自动打开 Find 面板） |
| **不做什么** | v1 不做：正则 / 替换 / 搜索 `detail` 列 / 说话人标签 / 术语库 / 跨模式智能排序 / `Cmd+K` 全局命令面板（可 v1.1）/ 服务端或云索引 |
| **与 ADR / architecture** | 索引 **只读** `segments.text`；写路径仍经既有 `file_save_segments`；不 fork 第二套 segment 存储。符合 [`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) |
| **风险** | **R1** 大库首次 migration 建 FTS 耗时 → 进度可 defer（后台 `PRAGMA` + 首搜前完成）；**R2** 简繁 / 标点分词 — v1 字面 `unicode61`；**R3** 内容跳转时 draft 未 flush — 跳转前走 Close Gate 既有链 |
| **Spike（可选 ≤0.5d）** | 10 万 `segments` 种子库：`LIKE` vs FTS5 P95 延迟；决定是否 v1 必须 FTS |

---

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| Rust DB | `db/migrations/welcome_search_fts.rs` | `segments_fts` + triggers + backfill |
| Rust API | `project/welcome_search_cmd.rs` | `welcome_search_files`、`welcome_search_content` |
| Rust types | `project/types.rs` | `WelcomeFileSearchHit`、`WelcomeContentSearchHit` |
| TS API | `tauri/welcomeSearchApi.ts` | invoke 封装 |
| Service | `services/welcome/welcomeSearchSnippets.ts` | snippet 裁剪（可复用 find 逻辑） |
| Hook | `hooks/useWelcomeSearchController.ts` | debounce、mode、results、navigate |
| UI | `WelcomeTopBar.tsx`、`WelcomeSearchResults.tsx` | 输入 + 模式切换 + 列表 |
| Editor 衔接 | `useWelcomeSearchHandoff.ts` 或扩展现有 selection | `pendingContentHighlight` 一次性消费 |
| 测试 | `welcome_search_cmd.rs` tests、`welcomeSearch*.test.ts` | 文件/内容/空查询/跳转契约 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-18 | 初版：双模式（文件/内容）+ FTS5 内容检索 + SQL 文件检索 |
