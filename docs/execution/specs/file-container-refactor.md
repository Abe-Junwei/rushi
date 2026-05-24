# Spec: 项目文件容器化重构

**决策日期**: 2026-05-24  
**决策来源**: 用户拍板（见下方「已确认决策」）  
**关联规划**: 本 spec 取代 `collaboration-foundation-plan.md` 的 Phase 1 优先级，文件容器改造完成后协作骨架基于新模型搭建。

---

## 已确认决策

| # | 问题 | 决策 |
|---|------|------|
| 1 | 无音频文件的编辑视图 | **B. 简化时间轴** — 保留横向布局，纯色块/进度条代替真实波形 |
| 2 | 纯文本文件的 Segment 时间戳 | **A. 估算时间戳** — 按字数 ÷ 语速（250字/分钟）推算 start_sec/end_sec |
| 3 | 项目包内嵌可编辑格式 | **A. SRT** — ZIP 内每个文件附带 `transcript.srt`，纯文本可编辑 |
| 4 | 传输粒度 | **C. 两者都支持** — 整个项目 ZIP + 单独导出/导入单个文件 SRT |
| 5 | 新建项目入口 | **C. 两者并存** — 「新建空项目」+「导入文件自动创建项目」 |
| 6 | 文件类型显式分类 | **B. 显式标签** — 纯文本 / 音频+文本 / 待转写音频 |
| 7 | 与协作方向的优先级 | **A. 暂停协作骨架**，先完成文件容器改造 |
| 8 | 历史数据迁移 | **Greenfield** — 无旧数据，全新 schema，不用兼容层 |

---

## 用户任务

1. 创建空项目，以后往里添加音频或文本文件。
2. 直接导入一个 SRT/TXT 文件，自动创建项目并开始编辑（无需音频）。
3. 导入音频文件，自动创建项目并转写。
4. 在项目内看到多个文件列表，切换编辑不同文件。
5. 导出整个项目给同事（ZIP），同事解压后直接改里面的 SRT 文件。
6. 导出单个文件为 SRT，同事改完传回，重新导入更新。
7. 没有音频的文本文件也能正常编辑、拆分、合并、导出。

---

## UI 落点

### 欢迎页（A 阶段）

新增/调整入口：
- **「新建空项目」**：弹窗输入项目名称 → 创建空项目 → 进入项目详情页（文件列表为空，提示添加文件）。
- **「导入文本文件」**：文件选择器（`.txt` / `.srt`）→ 自动创建项目（名称 = 文件名）→ 解析文本为 segments → 进入编辑页。
- **「导入音频文件」**：保持现有流程，但底层改为「创建项目 + 创建 paired 文件 + 自动转写」。
- **最近项目列表**：显示项目名 + 文件数量。

### 项目详情页 / 工作页（B 阶段）

新增**文件列表侧栏**（左轨下方或独立面板）：
```
📁 项目名称
├── 📝 第一章.srt        [文本]
├── 🔊 第二章.wav        [待转写]
├── 🎙️ 第三章            [音频+文本]
└── ➕ 添加文件...
```

- 点击文件切换编辑目标。
- 类型标签显式显示：`[文本]`、`[待转写]`、`[音频+文本]`。
- 文件操作：重命名、删除、导出单个文件。

### 编辑区域（按文件类型适配）

| 文件类型 | 波形区 | 时间轴 | 语段卡片 |
|----------|--------|--------|----------|
| 音频+文本 | 真实波形 | 秒刻度 + 语段条 | 正常 |
| 纯文本 | 隐藏/显示占位提示 | 秒刻度 + 纯色块背景 + 语段条 | 正常 |
| 待转写音频 | 真实波形 | 秒刻度 | 显示「转写」按钮占位 |

---

## 状态模型

### 空态
- 新建空项目后，文件列表为空，主区域显示「点击左侧添加文件」。

### 忙碌态
- 导入大 TXT 文件解析中：显示进度条。
- 音频转写中：显示转写进度（保持现有 busy overlay）。

### 成功态
- 文件导入成功：文件列表新增条目，自动选中并进入编辑。
- 导出成功：系统通知 + 文件路径提示。

### 失败态
- 导入文件格式不支持：错误提示「仅支持 .txt / .srt / .wav / .mp3 / .m4a」。
- TXT 解析失败（如编码错误）：提示「文件编码无法识别，请转为 UTF-8」。
- SRT 时间戳格式错误：提示「SRT 格式异常，第 X 行无法解析」。

### 恢复路径
- 导入失败不创建脏项目，保持欢迎页状态。
- 转写失败保留音频文件，标记为「待转写」，用户可重试。

---

## 前后端契约

### 数据库 Schema（Greenfield）

```sql
-- 项目容器
CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

-- 文件条目
CREATE TABLE files (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('text', 'paired', 'audio_only')),
    audio_path TEXT,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

-- 语段（挂在文件下）
CREATE TABLE segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    start_sec REAL NOT NULL DEFAULT 0,
    end_sec REAL NOT NULL DEFAULT 0,
    text TEXT NOT NULL DEFAULT '',
    confidence REAL,
    low_confidence INTEGER NOT NULL DEFAULT 0,
    detail TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE (file_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_segments_file ON segments(file_id);

-- 编辑日志（挂在项目下，记录项目级操作）
CREATE TABLE edit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    at_ms INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 术语库（全局，不挂项目）
CREATE TABLE glossary_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at_ms INTEGER NOT NULL
);

-- 纠错记忆（全局）
CREATE TABLE correction_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    before_text TEXT NOT NULL,
    after_text TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    accepted_as_rule INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    UNIQUE (before_text, after_text)
);
```

### Rust DTO

```rust
#[derive(Debug, Serialize)]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub file_count: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct ProjectDetail {
    pub id: String,
    pub name: String,
    pub files: Vec<FileSummary>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct FileSummary {
    pub id: String,
    pub name: String,
    pub file_type: String, // "text" | "paired" | "audio_only"
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
pub struct FileDetail {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub file_type: String,
    pub audio_path: Option<String>,
    pub segments: Vec<SegmentDto>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentDto {
    pub idx: i32,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
    pub confidence: Option<f64>,
    pub low_confidence: bool,
    pub detail: Option<String>,
}
```

### Tauri Commands（新增/调整）

```rust
// 项目级
#[tauri::command] pub fn create_empty_project(name: String) -> Result<ProjectDetail, String>
#[tauri::command] pub fn list_projects() -> Result<Vec<ProjectSummary>, String>
#[tauri::command] pub fn delete_project(project_id: String) -> Result<(), String>

// 文件级
#[tauri::command] pub fn create_project_from_text(path: String) -> Result<ProjectDetail, String>
#[tauri::command] pub fn create_project_from_audio(path: String) -> Result<ProjectDetail, String>
#[tauri::command] pub fn add_text_file(project_id: String, path: String) -> Result<FileDetail, String>
#[tauri::command] pub fn add_audio_file(project_id: String, path: String) -> Result<FileDetail, String>
#[tauri::command] pub fn list_files(project_id: String) -> Result<Vec<FileSummary>, String>
#[tauri::command] pub fn load_file(file_id: String) -> Result<FileDetail, String>
#[tauri::command] pub fn rename_file(file_id: String, name: String) -> Result<(), String>
#[tauri::command] pub fn delete_file(file_id: String) -> Result<(), String>

// 语段级（从 project_id 改为 file_id）
#[tauri::command] pub fn save_file_segments(file_id: String, segments: Vec<SegmentDto>) -> Result<(), String>
#[tauri::command] pub fn run_transcribe(file_id: String) -> Result<RunTranscribeOutcome, String>

// 导出级
#[tauri::command] pub fn export_project_bundle(project_id: String, default_filename: String) -> Result<Option<String>, String>
#[tauri::command] pub fn import_project_bundle() -> Result<Option<ProjectDetail>, String>
#[tauri::command] pub fn export_file_srt(file_id: String, default_filename: String) -> Result<Option<String>, String>
#[tauri::command] pub fn import_file_srt(project_id: String, path: String) -> Result<FileDetail, String>
#[tauri::command] pub fn export_text_file(default_filename: String, content: String) -> Result<Option<String>, String>
#[tauri::command] pub fn export_docx(...) -> Result<Option<String>, String>
```

---

## 最小实现范围

### Slice 1：数据层重构（2–4h）
1. 重写 `db.rs` schema（projects / files / segments）。
2. 重写 `types.rs` DTO。
3. 添加 `file_type` 枚举与校验。
4. 迁移脚本（幂等，greenfield 但保留 `migrate()` 入口）。
5. Rust 编译通过。

### Slice 2：项目 CRUD 重构（2–4h）
1. `create_empty_project`：创建空项目。
2. `create_project_from_text`：导入 TXT/SRT → 项目 + 文件。
3. `create_project_from_audio`：导入音频 → 项目 + paired 文件 + 转写。
4. `list_projects`、`delete_project`：适配新 schema。
5. 前端欢迎页入口调整。

### Slice 3：文件列表与工作页（2–4h）
1. `list_files`、`load_file`、`rename_file`、`delete_file`。
2. 左轨文件列表组件。
3. 文件类型标签渲染。
4. 工作页切换文件逻辑。

### Slice 4：语段操作迁移（2–4h）
1. `save_file_segments`（替代 `save_project_segments`）。
2. `useSegmentMutationController` 改为 file-level。
3. 确保 undo/redo、拆分/合并、边界拖拽仍正常工作。

### Slice 5：无音频视图（2–4h）
1. TXT 解析与分句逻辑（按换行/句号）。
2. 估算时间戳：`segment_duration = text.len() / (250.0 / 60.0)` 秒（中文字符）。
3. 波形区条件渲染：有音频 = 真实波形，无音频 = 纯色块背景。
4. 时间轴在无音频时隐藏秒刻度或显示相对比例。

### Slice 6：导出重构（2–4h）
1. 项目包 ZIP 新结构：`files/<file_id>/transcript.srt` + `files/<file_id>/audio.wav`。
2. 项目包导入：解析 manifest → 恢复 projects + files + segments。
3. 文件级 SRT 导出/导入（双向）。
4. sidecar JSON（`.meta.json`）v1：只含 `revision_chain`（变更历史）。
5. `export_docx` 适配 file-level。

### Slice 7：诊断包与收尾（1–2h）
1. 诊断包适配新 schema。
2. 全部硬闸门通过。
3. 至少 1 条主路径手测。

---

## 下一轮主题：SRT 审阅模式（sidecar v2）

**前提**：文件容器改造完成，基础 SRT 双向交换已跑通。

**目标**：让 SRT + sidecar JSON 具备 Word 级别的审阅能力。

**sidecar v2 新增字段**：
- `pending_changes` — 建议修改（SuggestionEdit），含接受/拒绝状态
- `annotation_threads` — 批注线程（AnnotationThread + AnnotationComment）

**对应 UI**：
- 审阅模式开关（transcription ↔ review）
- 批注 marker、评论线程边栏
- 建议修改的接受/拒绝按钮
- 活动流（按时间线展示所有审阅动作）

**与协作架构的衔接**：
sidecar v2 的数据结构直接映射到 `collaboration-review-domain-api.md` 中的领域对象，未来上传到协作服务器时不丢失。

### Slice 7：诊断包与收尾（1–2h）
1. 诊断包适配新 schema。
2. 全部硬闸门通过。
3. 至少 1 条主路径手测。

---

## 验收方式

### 自动化
- [ ] `cargo test` 通过。
- [ ] `cargo clippy` 无 error。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run test` 通过（112+ 测试）。
- [ ] `npm run lint` 无新增 error。
- [ ] `node scripts/check-architecture-guard.mjs` 无新增 error。

### 手测主路径
- [ ] 新建空项目 → 添加 TXT 文件 → 编辑文本 → 保存 → 导出 SRT → 用文本编辑器改 SRT → 重新导入 → 文本已更新。
- [ ] 导入音频 → 自动转写 → 编辑语段 → 保存 → 导出项目 ZIP → 解压确认内含 `transcript.srt`。
- [ ] 项目内有多个文件（1 个纯文本 + 1 个 paired）→ 切换文件 → 视图形态正确变化。
- [ ] 无音频文件的语段可拆分/合并/导出 SRT，时间轴显示纯色块。

---

## 风险与防漂移提醒

1. **不要同时改协作方向**：本 spec 明确暂停协作骨架，直到文件容器改造完成。
2. **不要保留旧 schema 兼容层**：greenfield 决策意味着旧表结构完全替换，不维护双轨。
3. **不要把 Word 当工作格式**：项目包内嵌 SRT 是交换层，DOCX 保持单向导出。
4. **不要把文件类型混成运行时状态**：`file_type` 是持久化字段，不是 UI 开关。
5. **Segment 时间戳估算只在导入时做一次**：后续编辑不重新估算，避免用户修改后时间戳乱跳。
