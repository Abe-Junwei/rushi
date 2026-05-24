# 本地独立 + 联机协作存储与 Schema 草案

## 目标
为 Rushi 增加“本地独立 + 联机协作”双模式存储体系，满足多人批注、审阅、编辑、历史追踪与 Word 导出投影需求，同时保留桌面端本地 SQLite 在本地项目中的正式真源地位。

## 当前真源与缺口
当前本地真源由以下部分组成：
- `projects`：项目元数据与音频副本路径
- `segments`：语段快照
- `edit_log`：保存批次日志
- `glossary_terms`、`correction_memory`：单机辅助能力

该模型的问题是：
- 只能支撑单机真源，无法支撑多人联机协作。
- `edit_log` 粒度过粗，不足以支撑正式审阅和历史回放。
- 无法表达评论线程、建议修改、Presence、软锁、任务化导出。

但它仍然有价值：
- 适合作为“本地独立项目”的正式真源。
- 适合作为协作项目的离线缓存与恢复层。

## 双模式存储分层

### 模式 A：本地独立项目
1. 桌面端本地 SQLite：正式真源
  - 项目、语段、导出、最近编辑记录
2. 本地文件系统
  - 音频副本、日志、恢复文件、项目包

### 模式 B：联机协作项目
1. PostgreSQL：协作真源
  - 项目、语段、评论、建议修改、版本事件、协作者关系、导出任务
2. 对象存储（S3/OSS/MinIO 均可）
  - 原始音频、转码音频、导出 DOCX、导出项目包、附件
3. 桌面端本地 SQLite
  - 最近项目缓存、离线草稿、最近打开、恢复信息
4. 项目包（zip）
  - 单项目迁移/归档格式，不作为实时协作真源

## 核心原则
- 本地项目与协作项目并存，不要求“一刀切”迁移。
- 服务端只对协作项目承担唯一真源职责。
- 本地 SQLite 在协作项目中不再承担正式协作审计职责，但在本地项目中仍为正式真源。
- 结构化对象与历史事件分离：当前投影快照 + append-only 事件流。
- 媒体文件与业务元数据分离：数据库存引用，对象存储存大文件。
- 工作模式显式区分“转录模式”和“审阅模式”；批注/建议修改只在审阅模式暴露。

## 模型区分：项目来源 vs 工作模式

### 项目来源
- `local`：纯本地独立项目
- `collaborative`：联机协作项目

### 工作模式
- `transcription`：转录/校对模式，只显示正文编辑、时间轴、ASR、基础状态
- `review`：审阅模式，显示批注线程、建议修改、协作者进度与活动流

二者不要混淆：
- 本地项目也可以进入审阅模式，但其批注仅本地可见，且不要求多人实时同步。
- 协作项目既可以在转录模式下工作，也可以切换到审阅模式做批注和审阅。

## 核心表设计

### projects
```sql
create table projects (
  id uuid primary key,
  workspace_id uuid not null,
  title text not null,
  project_source text not null default 'collaborative',
  status text not null default 'active',
  source_language text,
  primary_audio_asset_id uuid,
  latest_revision_seq bigint not null default 0,
  created_by uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz
);
```

`project_source` 建议：`collaborative`。本地项目不要求进入服务端该表；若未来支持“本地项目发布为协作项目”，可在服务端创建对应协作副本。

### project_collaborators
```sql
create table project_collaborators (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  joined_at timestamptz not null,
  primary key (project_id, user_id)
);
```
角色建议：`owner` / `editor` / `reviewer` / `viewer`

### media_assets
```sql
create table media_assets (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null,
  storage_key text not null,
  original_filename text not null,
  mime_type text,
  byte_size bigint,
  duration_ms bigint,
  checksum_sha256 text,
  created_by uuid not null,
  created_at timestamptz not null
);
```
`kind` 建议：`source_audio` / `proxy_audio` / `export_docx` / `project_bundle`

### transcript_segments
```sql
create table transcript_segments (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  ordinal integer not null,
  start_ms bigint not null,
  end_ms bigint not null,
  speaker_label text,
  text text not null default '',
  confidence numeric,
  workflow_mode text not null default 'transcription',
  review_status text not null default 'draft',
  locked_by uuid,
  lock_expires_at timestamptz,
  version bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (project_id, ordinal)
);
create index idx_transcript_segments_project on transcript_segments(project_id, ordinal);
```
`review_status` 建议：`draft` / `in_review` / `approved` / `final`

`workflow_mode` 建议：`transcription` / `review`

说明：
- `workflow_mode` 表示该语段当前主要工作阶段，便于统计转录进度与审阅进度。
- UI 切换为转录模式时，不显示 annotation marker；切换为审阅模式时，才显示与该语段关联的批注/建议修改。

### annotation_threads
```sql
create table annotation_threads (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  target_kind text not null,
  target_segment_id uuid references transcript_segments(id) on delete cascade,
  target_text_anchor jsonb,
  target_time_anchor jsonb,
  thread_kind text not null,
  status text not null default 'open',
  created_by uuid not null,
  created_at timestamptz not null,
  resolved_by uuid,
  resolved_at timestamptz
);
create index idx_annotation_threads_project on annotation_threads(project_id, status, created_at desc);
```
说明：
- `target_kind`：`segment` / `text_range` / `time_range`
- `thread_kind`：`comment` / `question` / `issue` / `suggestion`
- `target_text_anchor` 保存字符范围、文本指纹、上下文

### annotation_comments
```sql
create table annotation_comments (
  id uuid primary key,
  thread_id uuid not null references annotation_threads(id) on delete cascade,
  author_id uuid not null,
  body text not null,
  mentions jsonb,
  created_at timestamptz not null,
  updated_at timestamptz
);
create index idx_annotation_comments_thread on annotation_comments(thread_id, created_at);
```

### suggestion_edits
```sql
create table suggestion_edits (
  id uuid primary key,
  thread_id uuid not null references annotation_threads(id) on delete cascade,
  target_segment_id uuid not null references transcript_segments(id) on delete cascade,
  base_version bigint not null,
  before_text text not null,
  suggested_text text not null,
  status text not null default 'pending',
  created_by uuid not null,
  created_at timestamptz not null,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text
);
create index idx_suggestion_edits_segment on suggestion_edits(target_segment_id, status);
```
`status` 建议：`pending` / `accepted` / `rejected` / `superseded`

### revision_events
```sql
create table revision_events (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  seq bigint not null,
  actor_id uuid not null,
  event_type text not null,
  entity_kind text not null,
  entity_id uuid,
  base_revision bigint,
  payload jsonb not null,
  created_at timestamptz not null,
  unique (project_id, seq)
);
create index idx_revision_events_project on revision_events(project_id, seq desc);
```
说明：
- `seq` 是项目内单调递增序号。
- `payload` 保存结构化差异，而不是仅存字符串日志。

### project_snapshots
```sql
create table project_snapshots (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  revision_seq bigint not null,
  snapshot_kind text not null,
  storage_key text not null,
  created_at timestamptz not null,
  unique (project_id, revision_seq, snapshot_kind)
);
```
用途：定期快照，避免从 0 开始重放完整事件流。

### presence_sessions
```sql
create table presence_sessions (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null,
  client_id text not null,
  state jsonb not null,
  last_seen_at timestamptz not null
);
create index idx_presence_sessions_project on presence_sessions(project_id, last_seen_at desc);
```
`state` 可含当前选中语段、光标位置、当前视图、软锁对象、工作模式、最近编辑内容摘要、用户进度摘要。

建议 `state` 结构：
```json
{
  "workflowMode": "transcription",
  "selectedSegmentId": "seg_123",
  "editingSegmentId": "seg_123",
  "cursorRange": { "start": 3, "end": 8 },
  "progress": {
    "transcribedSegments": 120,
    "reviewedSegments": 48,
    "pendingReviewSegments": 72
  },
  "lastEditPreview": "修订后的最近一句正文"
}
```

## 可见进度的计算建议
协作中“看到其他人的编辑进度和内容”建议分两层：
- Presence 实时层：当前正在编辑哪一段、最近编辑了什么、当前处于转录还是审阅模式。
- 持久统计层：项目整体进度、每位成员已完成语段数、待审阅语段数、待处理批注数。

可通过以下方式实现：
- `transcript_segments.review_status`
- `transcript_segments.workflow_mode`
- `revision_events`
- 物化视图或定时聚合表 `project_progress_counters`（实现时再决定是否落表）

### export_jobs
```sql
create table export_jobs (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  requested_by uuid not null,
  export_kind text not null,
  options jsonb not null,
  status text not null,
  output_asset_id uuid references media_assets(id),
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  failure_reason text
);
create index idx_export_jobs_project on export_jobs(project_id, created_at desc);
```
`export_kind` 建议：`docx_clean` / `docx_reviewed` / `docx_suggestion_summary` / `project_bundle`

## 事件类型建议
- `project_created`
- `segment_created`
- `segment_text_changed`
- `segment_timing_changed`
- `segment_split`
- `segment_merged`
- `segment_workflow_mode_changed`
- `segment_status_changed`
- `thread_opened`
- `thread_resolved`
- `comment_added`
- `suggestion_created`
- `suggestion_accepted`
- `suggestion_rejected`
- `export_requested`

## 并发控制策略
- 语段层面使用 `version` 做乐观并发控制。
- 服务端对写入按项目维度分配单调 `revision_events.seq`。
- `locked_by` / `lock_expires_at` 只做软锁提示，不做强互斥事务锁。
- 评论与建议修改天然 append-only，冲突面小于正文编辑。

## 离线与本地缓存策略
协作项目下，桌面端 SQLite 建议只保留：
- 最近同步的项目投影缓存
- 未提交本地草稿
- 本地恢复元数据
- 已下载媒体缓存路径

不再要求本地 SQLite 承担：
- 全量协作历史真源
- 正式审阅审计真源
- 多端一致性仲裁

本地项目下，桌面端 SQLite 继续承担：
- 项目正式真源
- 语段当前快照
- 本地审阅状态与可选本地批注
- 导出与恢复所需最小历史

## 与项目包（zip）的关系
项目包保留为交换层，继续包含：
- `manifest.json`
- `project.json`
- `audio/...`

协作版导出项目包时建议策略：
- 默认导出项目当前语段快照与主音频
- 可选导出评论线程与建议修改摘要，但仅在审阅模式或显式勾选时导出
- 不默认导出全量 revision_events，避免包体过大

## 迁移建议
1. 先保留本地项目能力，不立即删除本地 SQLite 真源路径。
2. 新增协作项目类型与服务端 schema。
3. 桌面端对协作项目进入双写过渡：保存到服务端，同时保留本地缓存。
4. 本地 `edit_log` 在协作项目中逐步退化为缓存恢复线索，不再当审计真源。
5. 稳定后让项目列表显式区分本地项目与协作项目，而不是默认强制切到服务端。

## 风险与取舍
- 若直接上全局 CRDT，复杂度过高，且语段/批注这种结构化对象并不需要全文级冲突自由。
- 若继续只保留粗粒度 `edit_log`，则无法满足正式审阅与历史追溯。
- 若把 Word 文档当真源，会极大限制实时协作、结构化批注与跨端一致性。
