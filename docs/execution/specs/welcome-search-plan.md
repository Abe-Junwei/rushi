# Spec(plan): Welcome 搜索 — 文件 vs 内容

> **Research brief**：[`welcome-search-research.md`](./welcome-search-research.md)  
> **Intent**：[`welcome-search-intent.md`](./welcome-search-intent.md)  
> **Acceptance**：[`welcome-search-acceptance.md`](./welcome-search-acceptance.md)

## 总览

```text
Phase 1  WS-1  Rust 文件搜索 API
Phase 2  WS-2  Welcome UI — 文件模式
Phase 3  WS-3  FTS migration + Rust 内容搜索 API
Phase 4  WS-4  Welcome UI — 内容模式 + Editor handoff
Phase 5  WS-5  抛光 + 手测
```

**日历估算（单人）**：约 **1–1.5 周**（5 片 × 2–4h）。

---

## Phase 1 — 文件搜索 API `WS-1`

### Rust：`welcome_search_cmd.rs`

```rust
#[tauri::command]
pub fn welcome_search_files(
    state: State<DbState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<WelcomeFileSearchHit>, String>
```

**查询逻辑（示意）**

```sql
SELECT
  p.id AS project_id,
  p.name AS project_name,
  f.id AS file_id,
  f.name AS file_name,
  f.updated_at_ms,
  /* matched_field: 'file_name' | 'project_name' | 'narrator' | ... */
FROM files f
INNER JOIN projects p ON p.id = f.project_id
WHERE trim(?1) != ''
  AND (
    f.name LIKE '%' || ?1 || '%' COLLATE NOCASE
    OR p.name LIKE '%' || ?1 || '%' COLLATE NOCASE
    OR IFNULL(p.narrator, '') LIKE '%' || ?1 || '%' COLLATE NOCASE
    OR IFNULL(p.recorded_at, '') LIKE '%' || ?1 || '%' COLLATE NOCASE
    OR IFNULL(p.location, '') LIKE '%' || ?1 || '%' COLLATE NOCASE
    OR IFNULL(p.subject, '') LIKE '%' || ?1 || '%' COLLATE NOCASE
    OR IFNULL(p.transcriber, '') LIKE '%' || ?1 || '%' COLLATE NOCASE
  )
ORDER BY f.updated_at_ms DESC
LIMIT ?2;
```

- 空 query → `[]`（不报错）
- `matched_field` 供 UI 显示次要标签（如「讲述人匹配」）
- 仅返回 **有 file 行** 的项目命中；若未来需「仅项目名、零文件」单独展示，放 v1.1

### TS

- `tauri/welcomeSearchApi.ts` — `searchWelcomeFiles(query)`
- `services/welcome/welcomeSearchTypes.ts` — DTO 镜像

### 测试

- Rust：大小写不敏感、元信息命中、空串、LIMIT
- 无 UI 变更

---

## Phase 2 — Welcome UI 文件模式 `WS-2`

### 组件

| 文件 | 职责 |
|------|------|
| `hooks/useWelcomeSearchController.ts` | `mode: 'file' \| 'content'`、`query`、`debouncedQuery`（320ms，对齐 find）、`fileResults`、`loading`、`error` |
| `components/WelcomeSearchModeToggle.tsx` | 分段控件「文件 \| 内容」；`aria-pressed` |
| `components/WelcomeSearchResults.tsx` | 浮层列表；文件行：主标题 `file_name`、副标题 `project_name`、匹配来源 chip |
| `WelcomeTopBar.tsx` | 去 `readOnly`；接 controller；`placeholder`：`搜索项目或文件…` / `搜索转写正文…` |

### 交互

- 输入 ≥1 字符（trim 后）触发搜索
- `Escape` 关闭结果层；失焦延迟关闭（避免点击结果前消失）
- 点击文件行：**默认** `loadProject` + Hub（`closeFile`），Hub 列表 scroll 到对应 `file_id`（扩展现有 Hub ref 或 `data-file-id` query）
- 行内次要动作「打开」：`openFile` 进 Editor（与最近文件一致）

### 状态持久化

- `localStorage` key：`rushi:welcome-search-mode:v1` → `'file' | 'content'`（Phase 2 仅写 file 默认值）

---

## Phase 3 — 内容 FTS + API `WS-3`

### Migration `db/migrations/welcome_search_fts.rs`

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts USING fts5(
  text,
  content='segments',
  content_rowid='id',
  tokenize='unicode61'
);

-- triggers: segments_ai / segments_ad / segments_au → fts insert/delete/update
-- one-time: INSERT INTO segments_fts(segments_fts) VALUES('rebuild');
```

- 注册进现有 migration 链（与 `projects` P0 列迁移同级模式）
- **禁止** 在 UI 层维护索引；所有 segment 写路径须经过 DB（已有）

### Rust：`welcome_search_content`

```rust
pub fn welcome_search_content(
    state: State<DbState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<WelcomeContentSearchHit>, String>
```

- FTS：`segments_fts MATCH ?`（对用户输入做 **短语转义**：双引号包裹 + 内部 `"` 加倍，防 FTS 语法注入）
- Join：`segments` → `files` → `projects`
- 返回：`project_id`、`file_id`、`segment_idx`（`segments.idx`）、`snippet`（Rust 或 TS 侧裁剪）、`start_sec` / `end_sec`

### 测试

- 插入多文件语段 → 跨文件命中
- 更新 segment text → 索引更新
- 删除 file cascade → 命中消失

---

## Phase 4 — 内容模式 UI + Editor handoff `WS-4`

### Welcome 内容结果行

- 主行：snippet（命中词 `<mark>` 或现有 `FindReplaceMatchText` 样式）
- 副行：`project_name` / `file_name` · 语段起点时间码
- 点击：`navigateToContentHit(hit)`

### `navigateToContentHit` 流程

```text
busy? → Close Gate 若需要
loadProject(projectId)
openFile(fileId)
setPendingWelcomeContentHighlight({ segmentIdx, charStart, charEnd })
selectSegmentAt(segmentIdx, 'welcome-search')
scheduleScrollSegmentListIndexToView(segmentIdx)
```

### Editor 消费（一次性）

- `pages/useWelcomeSearchHandoff.ts` 或扩 `useTranscriptionLayerSelection`
- mount 后读 pending → 语段列表行内高亮 char range → clear pending
- **不** 打开 Find 对话框；不复用 `findText` state（避免污染）

---

## Phase 5 — 收尾 `WS-5`

- 空态文案：「无匹配项目或文件」/「无匹配语段」
- 加载中 skeleton（≤300ms 不闪也可省略）
- 架构守卫：若 `useWelcomeSearchController` 膨胀 → 拆 `welcomeSearchNavigate.ts` service
- 路线图 §10.4 Welcome 搜索 → 编码中 / ✅

---

## UI 线框（顶栏）

```text
┌─────────────────────────────────────────────────────────────┐
│  [ASR] [LLM]     ┌文件│内容┐  🔍 [ 搜索项目或文件…      ]   │
│                  └─────────┘                                │
│                  ┌─ 结果浮层 ─────────────────────┐         │
│                  │ 📄 访谈稿_20240315.txt          │         │
│                  │    项目 Alpha · 文件名匹配       │         │
│                  │ 📄 场次B.wav                    │         │
│                  │    项目 Beta · 讲述人匹配        │         │
│                  └────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

内容模式：结果区替换为 snippet 行 + 面包屑，无文件图标混排歧义。

---

## 依赖与顺序

- WS-2 **依赖** WS-1
- WS-4 **依赖** WS-3 + WS-2（共用 controller / 浮层壳）
- CSP v1.2 ✅ 已合并 — 浮层仅用 class/token，禁止 `style={{`
