# Spec: 翻译模块与词典编辑模块

**目标**: 为 Rushi 增加计算机辅助翻译（CAT）工作台能力：中译英双语编辑、子范围批注审阅、用户自建专业词典、术语一致性联动，以及专业 DOCX 交付格式导出。

**已确认决策**:
- 翻译输入：可用现有转写内容，也可独立导入新内容（TXT/DOCX/SRT）。
- 翻译引擎：可用 Rushi 内置 API，也可外部翻译后导入。
- 修订粒度：**方案 B（子范围批注）**——在语段内对词/短语添加批注/建议修改，不实现字符级 Track Changes。
- 翻译层：**在原 file 上叠加**——segments 新增 `target_text`/`target_status`，不生成独立双语文件。
- DOCX 导出首期：**对照表** + **干净稿**；批注稿放到二期。
- 术语联动：词典词条与翻译中的术语实时联动，确保一致性。

**关联文件**:
- `apps/desktop/src-tauri/src/db.rs` — 需新增/修改表
- `apps/desktop/src-tauri/src/project/types.rs` — 需新增 DTO
- `apps/desktop/src-tauri/src/project/transcribe.rs` — 翻译引擎调度参考
- `apps/desktop/src/pages/useGlossaryController.ts` — 现有术语库 UI 模式参考

---

## 1. 用户任务

1. 对已有语段文件发起中译英，逐段生成英文翻译。
2. 在翻译结果中审阅、编辑单段英文译文。
3. 构建个人/项目专业词典：添加词条（中→英）、词性、领域标签、例句。
4. 从现有术语库（glossary）一键迁移词条到词典，或反向将词典词条设为 ASR 热词。
5. 导出词典为 CSV/JSON 用于备份或与他人交换。
6. 导入外部词典（CSV/JSON）补充到个人词典。

---

## 2. 设计约束与口径

### 2.1 翻译粒度与修订深度
- **语段级对齐**：每个 SegmentDto 对应一条中文原文（`text`）+ 一条英文译文（`target_text`）。
- **子范围批注（方案 B）**：在语段内选中词/短语，添加批注或建议修改。不实现字符级 Track Changes（方案 C 技术复杂度极高，会阻塞其他功能）。
- 批注类型：`comment`（普通评论）、`suggestion`（建议修改，含 `suggested_text`）、`term_check`（术语一致性警告）。

### 2.2 翻译引擎策略
- 支持多引擎配置（DeepL / Google Translate / OpenAI / 百度 / 有道）。
- 默认引擎可配置；未配置时提示用户设置 API Key。
- 支持批量翻译（一次提交多条语段，减少 API 调用）。
- 翻译结果缓存：同一原文在 24h 内不重复调用 API。

### 2.3 词典与术语库的关系

| 维度 | 术语库（glossary_terms） | 词典（dictionary_entries） |
|------|------------------------|---------------------------|
| 用途 | ASR 热词注入 | 翻译参考 + 术语一致性 |
| 数据结构 | 简单字符串 `term` | 富结构化（中/英/词性/领域/例句） |
| 生命周期 | 全局 | 全局 |
| 互通 | 词典词条可标记「同时作为热词」→ 同步到 glossary | glossary term 可一键「升级为词典词条」 |

### 2.4 词典驱动翻译
- 翻译前：提取语段中的词典词条，构建「术语提示」随请求提交给翻译 API（若引擎支持）。
- 翻译后：用词典做术语一致性校验，若 API 返回的译文与词典不一致，标记 warning。

---

## 3. 数据模型

### 3.1 新增/修改 SQLite Schema

```sql
-- 语段表新增翻译字段（文件容器改造完成后 ALTER）
-- ALTER TABLE segments ADD COLUMN target_text TEXT NOT NULL DEFAULT '';
-- ALTER TABLE segments ADD COLUMN target_status TEXT NOT NULL DEFAULT 'none';
-- CHECK(target_status IN ('none', 'draft', 'mt', 'human', 'approved'));
-- ALTER TABLE segments ADD COLUMN source_locked INTEGER NOT NULL DEFAULT 0;

-- 翻译引擎配置（全局，单用户）
CREATE TABLE translation_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_kind TEXT NOT NULL CHECK(provider_kind IN ('deepl', 'google', 'openai', 'baidu', 'youdao')),
    display_name TEXT NOT NULL,
    api_key TEXT,
    api_endpoint TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

-- 翻译缓存（避免重复调用 API）
CREATE TABLE translation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_hash TEXT NOT NULL,  -- SHA-256(原文 + 引擎 + 术语提示)
    source_text TEXT NOT NULL,
    target_text TEXT NOT NULL,
    provider_kind TEXT NOT NULL,
    cached_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_translation_cache_hash ON translation_cache(source_hash);

-- 语段批注（子范围批注，方案 B）
CREATE TABLE segment_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    range_start INTEGER,        -- 语段内字符起始位置（NULL = 整段）
    range_end INTEGER,          -- 语段内字符结束位置
    kind TEXT NOT NULL CHECK(kind IN ('comment', 'suggestion', 'term_check')),
    body TEXT NOT NULL,
    suggested_text TEXT,        -- suggestion 类型时的建议文本
    author TEXT NOT NULL DEFAULT 'user',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_annotations_file ON segment_annotations(file_id);
CREATE INDEX IF NOT EXISTS idx_annotations_idx ON segment_annotations(file_id, idx);

-- 词典词条（富结构化，替代/扩展 glossary）
CREATE TABLE dictionary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_lang TEXT NOT NULL DEFAULT 'zh',
    source_term TEXT NOT NULL,
    target_lang TEXT NOT NULL DEFAULT 'en',
    target_term TEXT NOT NULL,
    pos TEXT,  -- part of speech: noun, verb, adj, etc.
    domain TEXT,  -- 领域标签，如 "佛教", "医学", "法律"
    example_source TEXT,
    example_target TEXT,
    notes TEXT,
    is_glossary_linked INTEGER NOT NULL DEFAULT 0,  -- 是否同步到 glossary_terms
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    UNIQUE (source_term, target_term)
);
CREATE INDEX IF NOT EXISTS idx_dictionary_source ON dictionary_entries(source_term COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_dictionary_domain ON dictionary_entries(domain);

-- 词典导入/导出日志
CREATE TABLE dictionary_import_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,  -- 'import' | 'export'
    format TEXT NOT NULL,  -- 'csv' | 'json'
    item_count INTEGER NOT NULL,
    file_path TEXT,
    at_ms INTEGER NOT NULL
);
```

### 3.2 Rust DTO

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentDto {
    pub idx: i32,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,               // 原文
    pub confidence: Option<f64>,
    pub low_confidence: bool,
    pub detail: Option<String>,
    // 翻译层（在原 file 上叠加）
    pub target_text: String,        // 译文
    pub target_status: String,      // "none" | "draft" | "mt" | "human" | "approved"
    pub source_locked: bool,        // 原文是否锁定
}

#[derive(Debug, Serialize)]
pub struct TranslationProviderDto {
    pub id: i64,
    pub provider_kind: String,
    pub display_name: String,
    pub api_endpoint: Option<String>,
    pub is_default: bool,
    pub is_enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct DictionaryEntryDto {
    pub id: i64,
    pub source_lang: String,
    pub source_term: String,
    pub target_lang: String,
    pub target_term: String,
    pub pos: Option<String>,
    pub domain: Option<String>,
    pub example_source: Option<String>,
    pub example_target: Option<String>,
    pub notes: Option<String>,
    pub is_glossary_linked: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct TranslateFileResult {
    pub file_id: String,
    pub translated_segments: i32,
    pub cached_segments: i32,
    pub failed_segments: i32,
    pub engine: String,
    pub warnings: Vec<String>,
}
```

---

## 4. 前后端契约

### 4.1 Tauri Commands

```rust
// ========== 翻译引擎配置 ==========
#[tauri::command]
pub fn translation_provider_list(state: State<DbState>) -> Result<Vec<TranslationProviderDto>, String>

#[tauri::command]
pub fn translation_provider_add(
    state: State<DbState>,
    provider_kind: String,
    display_name: String,
    api_key: Option<String>,
    api_endpoint: Option<String>,
) -> Result<TranslationProviderDto, String>

#[tauri::command]
pub fn translation_provider_delete(state: State<DbState>, id: i64) -> Result<(), String>

#[tauri::command]
pub fn translation_provider_set_default(state: State<DbState>, id: i64) -> Result<(), String>

// ========== 翻译执行 ==========
#[tauri::command]
pub async fn translate_file(
    state: State<'_, DbState>,
    file_id: String,
    provider_id: Option<i64>,  -- None = use default
) -> Result<TranslateFileResult, String>

#[tauri::command]
pub fn update_segment_target(
    state: State<DbState>,
    file_id: String,
    idx: i32,
    target_text: String,
    target_status: String,
) -> Result<(), String>

#[tauri::command]
pub fn clear_file_translation(
    state: State<DbState>,
    file_id: String,
) -> Result<(), String>

// ========== 语段批注（子范围批注，方案 B） ==========
#[tauri::command]
pub fn annotation_list(
    state: State<DbState>,
    file_id: String,
    idx: Option<i32>,
) -> Result<Vec<SegmentAnnotationDto>, String>

#[tauri::command]
pub fn annotation_add(
    state: State<DbState>,
    file_id: String,
    idx: i32,
    range_start: Option<i32>,
    range_end: Option<i32>,
    kind: String,
    body: String,
    suggested_text: Option<String>,
) -> Result<SegmentAnnotationDto, String>

#[tauri::command]
pub fn annotation_resolve(state: State<DbState>, id: i64) -> Result<(), String>

#[tauri::command]
pub fn annotation_delete(state: State<DbState>, id: i64) -> Result<(), String>

// ========== 术语一致性 ==========
#[tauri::command]
pub fn check_term_consistency(state: State<DbState>, file_id: String) -> Result<TermConsistencyReport, String>

#[tauri::command]
pub fn apply_dictionary_term_to_file(
    state: State<DbState>,
    file_id: String,
    dictionary_entry_id: i64,
) -> Result<i32, String>  -- 返回替换了几处

// ========== 词典 CRUD ==========
#[tauri::command]
pub fn dictionary_list(
    state: State<DbState>,
    domain: Option<String>,
    keyword: Option<String>,
) -> Result<Vec<DictionaryEntryDto>, String>

#[tauri::command]
pub fn dictionary_add(
    state: State<DbState>,
    source_term: String,
    target_term: String,
    pos: Option<String>,
    domain: Option<String>,
    example_source: Option<String>,
    example_target: Option<String>,
    notes: Option<String>,
    is_glossary_linked: bool,
) -> Result<DictionaryEntryDto, String>

#[tauri::command]
pub fn dictionary_update(
    state: State<DbState>,
    id: i64,
    source_term: String,
    target_term: String,
    pos: Option<String>,
    domain: Option<String>,
    example_source: Option<String>,
    example_target: Option<String>,
    notes: Option<String>,
    is_glossary_linked: bool,
) -> Result<DictionaryEntryDto, String>

#[tauri::command]
pub fn dictionary_delete(state: State<DbState>, id: i64) -> Result<(), String>

// 从 glossary 迁移到 dictionary
#[tauri::command]
pub fn glossary_to_dictionary(
    state: State<DbState>,
    glossary_term_id: i64,
    target_term: String,
) -> Result<DictionaryEntryDto, String>

// 从 dictionary 同步到 glossary
#[tauri::command]
pub fn dictionary_sync_to_glossary(state: State<DbState>, id: i64) -> Result<(), String>

// ========== 词典导入/导出 ==========
#[tauri::command]
pub fn dictionary_export_csv(state: State<DbState>, default_filename: String) -> Result<Option<String>, String>

#[tauri::command]
pub fn dictionary_export_json(state: State<DbState>, default_filename: String) -> Result<Option<String>, String>

#[tauri::command]
pub fn dictionary_import_csv(state: State<DbState>) -> Result<i32, String>

#[tauri::command]
pub fn dictionary_import_json(state: State<DbState>) -> Result<i32, String>
```

---

## 5. 分阶段实施

### Slice T1：翻译数据层（2–4h）
1. `db.rs` 新增/修改：
   - segments 新增 `target_text`/`target_status`/`source_locked`
   - 新增 `translation_providers`、`translation_cache`、`segment_annotations`
2. `types.rs` 扩展 SegmentDto + 新增 DTO。
3. 硬闸门：cargo check/test/clippy。

### Slice T2：翻译引擎与批量翻译（2–4h）
1. 新增 `translation_cmd.rs`：引擎配置增删改查。
2. 新增 `translation_engine.rs`：抽象翻译引擎接口 + DeepL 占位实现。
3. 新增 `translate_file` 命令：批量翻译语段，写入 `target_text`，标记 `target_status='mt'`。
4. 翻译缓存命中逻辑。
5. 硬闸门。

### Slice T3：词典编辑基础（2–4h）
1. `db.rs` 新增：`dictionary_entries`、`dictionary_import_log`。
2. `types.rs` 新增：`DictionaryEntryDto`。
3. 新增 `dictionary_cmd.rs`：词典 CRUD + 搜索/过滤。
4. 新增 `dictionary_io.rs`：CSV/JSON 导入导出。
5. glossary ↔ dictionary 双向同步命令。
6. 硬闸门。

### Slice T4：子范围批注 UI（2–4h）
1. 工作页新增「翻译」按钮 + 双语视图切换（原文 | 译文 | 双语）。
2. 语段卡片：原文在上，译文在下，均可编辑。
3. 选中译文中的词/短语 → 弹出批注按钮 → 添加 comment/suggestion。
4. 批注列表侧栏（按语段分组，显示未解决/已解决）。
5. `term_check` 批注自动渲染为黄色警告条。

### Slice T5：词典 UI 与术语联动（2–4h）
1. 全局「词典」面板（表格 + 搜索 + 领域筛选）。
2. 词条增删改查表单。
3. 术语一致性检查按钮：`check_term_consistency` → 生成报告 → 一键修复。
4. 编辑译文时实时检测词典术语变动 → 提示恢复/更新词典。
5. glossary 页面「升级为词典词条」按钮。

### Slice T6：DOCX 导出与收尾（2–4h）
1. DOCX 对照表格式：两列表格（原文左列 | 译文右列）。
2. DOCX 干净稿格式：仅输出最终译文。
3. TXT/SRT 双语模式（原文 + 译文）。
4. 硬闸门全绿 + 手测。

---

## 6. UI 落点

### 工作页（B 阶段）
- 文件工具栏新增「翻译」按钮（仅对 text/paired 文件可用）。
- 语段卡片底部新增翻译文本区域（默认折叠，点击展开）。
- 翻译状态标签：`[机翻]` `[已校对]` `[已审阅]`。

### 词典面板（全局侧栏或弹窗）
- 表格展示：中/英/词性/领域/操作。
- 顶部搜索框 + 领域筛选下拉。
- 底部导入/导出按钮。

### 设置页
- 翻译引擎配置：引擎类型、名称、API Key、Endpoint、默认开关。
- 词典管理：批量操作、清空、备份提醒。

---

## 7. 状态模型

### 翻译执行
- **空态**：文件未翻译，语段无 translation_text。
- **忙碌态**：批量翻译中，显示进度（第 N/M 段）。
- **成功态**：全部语段翻译完成，显示统计。
- **部分失败态**：部分语段 API 失败，显示失败原因 + 可重试。
- **失败态**：全部失败（如 API Key 无效、网络不通）。

### 词典编辑
- **空态**：词典为空，提示导入或手动添加。
- **忙碌态**：导入/导出大文件时显示进度。
- **成功态**：词条保存/导入/导出成功。
- **失败态**：重复词条（UNIQUE 冲突）、CSV 格式错误。

---

## 8. 验收方式

### 自动化
- [ ] `cargo test` 通过（新增翻译/词典测试）。
- [ ] `cargo clippy` 无 error。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run test` 通过。
- [ ] `npm run lint` 无新增 error。
- [ ] `node scripts/check-architecture-guard.mjs` 无新增 error。

### 手测主路径
- [ ] 导入纯 TXT 中文文件 → 自动按段落切分 → 点击翻译 → 全部语段生成英文 → 编辑某段英文 → 保存 → target_status 变为 'human'。
- [ ] 词典中添加「般若波罗蜜多 → prajñāpāramitā / 名词 / 佛教」→ 翻译含该词的语段 → 术语一致性检查 → 标记不一致 → 一键修复 → 译文更新。
- [ ] 编辑译文时删除「prajñāpāramitā」→ 实时提示「您删除了词典术语，是否恢复？」→ 点击恢复 → 文本复原。
- [ ] 选中译文中的词 → 添加 suggestion 批注「建议改为 X」→ 批注显示在侧栏 → 点击解决 → 批注标记为 resolved。
- [ ] glossary 中「般若」一键升级为词典词条 → 补全信息 → 保存 → 同步回 glossary → ASR 热词生效。
- [ ] 导出 DOCX 对照表 → 打开确认两列表格（原文 | 译文）。
- [ ] 导出 DOCX 干净稿 → 打开确认只含最终译文。
- [ ] 导出词典为 CSV → Excel 编辑 → 重新导入 → 新增/修改词条正确。

---

## 9. 与现有模块的关系

| 现有模块 | 影响 | 处理方式 |
|---------|------|---------|
| 文件容器（Slice 1–6） | 翻译挂在 file 下 | `translate_file` 命令接受 `file_id` |
| 术语库（glossary） | 单向升级为词典 | `glossary_to_dictionary` 命令，不删除原 glossary |
| 语段编辑（useSegmentMutationController） | 新增翻译字段 | SegmentDto 扩展 `translation_text`/`translation_status` |
| 导出（TXT/SRT/DOCX） | 支持双语导出 | 导出控制器新增双语模式选项 |
| ASR 转写 | 无直接影响 | 翻译在转写之后进行，独立流程 |

---

## 10. 风险与防漂移

1. **不要把翻译引擎做死到单一供应商**：抽象 `TranslationEngine` trait，至少预留 2 个实现（DeepL + OpenAI）。
2. **不要把词典和 glossary 强行合并**：保持独立表，通过 `is_glossary_linked` 关联，避免 glossary 的简单结构被词典污染。
3. **API Key 不要硬编码**：只存 SQLite，不写入日志，导出诊断包时自动脱敏。
4. **翻译缓存要设 TTL**：默认 24h，避免用户修改原文后仍返回旧缓存。
5. **词典导入要事务化**：CSV 解析失败时全部回滚，不留下半条数据。
6. **翻译不阻塞主路径**：批量翻译异步进行，用户可继续浏览/编辑其他文件。
