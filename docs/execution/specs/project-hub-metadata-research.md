# 调研：项目 Hub 导航 + 项目管理与场次元信息

> **状态**：规划门禁（2026-06-06）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)（文件容器 / 桌面 UI 纵向薄片）  
> **前置**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md)（Phase 6 签收 ✅）  
> **关联 spec**：待 `project-hub-metadata-intent.md` / `…-plan.md` / `…-acceptance.md`  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 口述史 / 访谈转写：一个「项目」= 一场采集或一次任务。用户需在 **文件 Hub** 管理项目（重命名、元信息），并从 **编辑器** 快速回到文件列表，而非仅靠顶栏后退。元信息含讲述人、时间、地点、主题、转录人等，供归档、检索与导出抬头。 |
| **本仓现状** | `projects` 表仅 `id, name, created_at_ms, updated_at_ms`（[`db.rs`](../../../apps/desktop/src-tauri/src/db.rs)）。文件 Hub = `ProjectFilesHubPanel`（`currentFileId === null`）；进 Hub 仅 `closeFile()`。项目 **重命名 / 元信息 / Hub 内删除** 无；欢迎页侧栏有 `deleteProject`（部分 `window.confirm`）。`CreateProjectModal` 只收 **项目名**，无重名提示。 |
| **成功标准** | （1）编辑中 ≥2 条路径进文件 Hub；（2）Hub 可编辑 **5 项核心元信息**（+ 可选 P1 扩展）并持久化；（3）创建/改名重名软提示；（4）Hub 内删/改名项目；（5）typecheck + 定向 test + 手测清单。 |

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表 | 核心机制 | 可验证链接 |
|---|------|------|----------|------------|
| A | **口述史 / 档案** | OHLA、BUIOH、DigitalNC、OHMS | 场次级 descriptive metadata：interviewee、interviewer、date、place、subject、transcriber；常映射 Dublin Core（Contributor / Coverage / Subject / Date） | [OHLA 归档指南 PDF](https://ohla.info/wp-content/uploads/2017/07/ArchivingOralHistoriesfromStarttoFinish_July5_2017.pdf)；[BUIOH metadata case study](https://ohda.matrix.msu.edu/2015/10/metadata-at-buioh-a-case-study/) |
| B | **通用转写 SaaS** | Descript、Otter、Trint | Project = 容器；Properties 含 title、created、成员；**弱场次元信息**（偏媒体池） | 产品内 Project settings（无公开 schema） |
| C | **桌面 NLE / 知识库** | Premiere Pro、Notion | Bin/Project 重命名 + 元数据面板；Notion DB 自定义属性列 | 交互参考：侧栏入口 + 属性面板 |
| D | **标准词汇** | Dublin Core 15 元素 | `creator/contributor/subject/coverage/date/description/language/rights` | [DC Usage Guide](https://www.dublincore.org/specifications/dublin-core/usageguide/elements/) |

**对照结论**：Rushi 用户场景接近 **路线 A（口述史场次）** 的 **精简子集**（仅讲述人/时间/地点/主题/转录人，不含采访人、摘要、语言等项目级字段）。UI 复杂度对齐 **路线 C**（Hub 内紧凑面板）。ASR 语言仍走既有 **环境/模型配置**，不在项目元信息重复维护。

---

## 3. 元信息字段决策

### 3.1 核心字段（P0，Hub「项目信息」表单 — **仅此 5 项默认展示**）

| 内部键 | 中文标签 | 说明 | DC 近似 |
|--------|----------|------|---------|
| `narrator` | **讲述人** | 主要说话人 / 被访者；多人用「、」或换行 | Contributor (interviewee) |
| `recorded_at` | **时间** | 采集/发生时间；**自由文本或 ISO 日期**（支持「2024-03 上旬」「约 1990 年代」） | Date / Coverage.temporal |
| `location` | **地点** | 采集地点或内容涉及地 | Coverage.spatial |
| `subject` | **主题** | 场次主题 / 题名补充（可与 `projects.name` 区分：name=工程名，subject=内容主题） | Subject |
| `transcriber` | **转录人** | 转写/校对负责人 | Contributor (transcriber) |

### 3.2 可选扩展（P1，表单折叠区「更多」— 用户未要求，实施时可整组 defer）

| 内部键 | 中文标签 | 理由 |
|--------|----------|------|
| `keywords` | **关键词** | 逗号分隔；后期欢迎页/列表筛选 |
| `rights_note` | **使用权限** | 如「仅限馆内研究」 |
| `source_id` | **馆藏编号** | 外部档号 / 来源系统 ID |
| `duration_note` | **时长说明** | 「约 2 小时」类说明；精确时长由 files 音频派生 |

### 3.3 明确不做（项目级元信息）

| 字段 | 原因 |
|------|------|
| `interviewer` 采访人 | **用户排除**；口述史三角角色不纳入本薄片 |
| `description` 摘要 | **用户排除** |
| `language` 语言 | **用户排除**；ASR/转写语言由 **环境与 ASR 设置** 真源，不在项目表重复 |

### 3.4 不单独建列（用现有或推导）

| 概念 | 处理 |
|------|------|
| 软件创建时间 | 已有 `created_at_ms` |
| 最后修改 | 已有 `updated_at_ms` |
| 文件数 / 总时长 | Hub 派生展示，不入库 |
| 说话人 diarization | 语段级 `speakerLabel`（协作域草案），**非项目元信息** |

---

## 4. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A 口述史 | **高** | 字段语义、导出抬头结构 | 不做 OHMS 同步、不上传流媒体 |
| B Descript | 低 | Hub 导航模式 | 元信息过浅 |
| C Notion/DC | 中 | 表单分组、label-caps 元数据行 | 不做完整 DC XML 导出（P2） |
| 本仓 file 级 CRUD | **高** | `useProjectFileMutationController`、Hub 布局、modal 栈 | 需新项目级 controller，禁止 mega-hook |

**本仓可复用模块**

- `ProjectFilesHubPanel` — Hub 壳 + header 扩展位
- `useProjectFileMutationController` — 删/改名模式可复制
- `CreateProjectModal` / `FloatingPanelTemplate` — 项目设置对话框尺寸记忆
- `compactDialog` + `dialogStack.ts` — 浮层 z-index
- `project_create_cmd.rs` / `project_delete_cmd.rs` — 扩展 `update_project`

---

## 5. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **Phase 10** 三薄片：A 导航 → B 项目 CRUD + 重名软提示 → C 元信息 schema + Hub 设置 UI |
| **存储** | SQLite `projects` 表 **5 列 nullable TEXT**（P0）；P1 四列 **Phase 10-C 可 defer**，首版仅迁 P0 |
| **重名** | **软约束**：`list_projects` 查同名 → 创建/改名对话框 warning；允许确认后继续；可选建议 `name (2)` |
| **Hub 入口** | 编辑顶栏「文件」按钮 + 面包屑项目名（已有 `onProjectHome`）+ 可选 `⌘⇧E` |
| **不做什么** | 采访人 / 摘要 / 项目级语言；OHMS/Omeka 同步；必填校验阻断创建；项目级 UNIQUE(name)；完整 DC XML；侧栏永久文件树 |
| **与 lifecycle 关系** | 扩展 [`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) 状态机：增加 **ProjectSettings** 动作；不改 file 级 Close Gate |
| **风险** | 字段增多 → 表单需分组 + 折叠；迁移仅 ADD COLUMN，Greenfield 友好 |

---

## 6. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| Rust | `db.rs` | `migrate_projects_metadata` |
| Rust | `project_metadata_cmd.rs`（新） | `update_project`, `rename_project` |
| Rust | `project_create_cmd.rs` | INSERT 含空 metadata 列 |
| TS | `projectTypes.ts` / `projectApi.ts` | `ProjectDetail` 扩展 |
| TS | `useProjectMutationController.ts`（新） | rename / delete / updateMetadata |
| UI | `ProjectFilesHubPanel.tsx` | header 操作 + 「项目信息」入口 |
| UI | `ProjectMetadataDialog.tsx`（新） | compactDialog 表单 |
| UI | `EditorToolbar.tsx` | 「文件」→ `closeFileWrapped` |
| UI | `CreateProjectModal.tsx` | 创建后可选「填写场次信息」链接；重名 warn |
| 测试 | vitest + Rust | metadata round-trip；rename 事务；duplicate name warn |
| 文档 | `desktop-project-file-lifecycle.md` | Hub / 项目 CRUD 矩阵 |

---

## 7. 实施薄片（Phase 10）

| 薄片 | 内容 | 估时 |
|------|------|------|
| **10-A** | 编辑 → 文件 Hub 多入口（按钮 + 面包屑 + 快捷键） | 0.5d |
| **10-B** | `rename_project` / Hub 删项目 / 重名软提示 / 去掉 welcome 外 confirm | 1d |
| **10-C** | DB 迁移（**5 列 P0**）+ `update_project` + `ProjectMetadataDialog` | 1d |
| **10-D** | acceptance + 导出抬头预留（DOCX 封面读 metadata，可 P1 仅读不写） | 0.5d |

**编码顺序**：A → B → C → D（B 与 C 可同 PR 若控制 diff）。

---

## 8. 能力—UI 状态矩阵（预览）

| UI | 条件 | 预期 |
|----|------|------|
| 「文件」按钮 | 编辑中 | `closeFileWrapped` → 文件 Hub |
| 项目信息 | Hub | 打开 `ProjectMetadataDialog`，保存 → `refreshProjectHub` |
| 重命名项目 | Hub header | inline 或对话框；同名 warn |
| 删除项目 | Hub | modal 确认；当前项目 → Welcome |
| 创建项目 | 同名已存在 | 黄色提示，可继续 |

---

## 9. 签收

- [x] 调研 brief 完成
- [x] 用户确认 P0 字段集（5 项；排除采访人/摘要/语言）
- [x] intent / plan / acceptance 已链接本文
- [x] 确认后可进入编码（Phase 10 签收 2026-06-08）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-06 | 初版：用户 5 字段 + 口述史/DC 调研补充 |
| 2026-06-06 | 用户拍板：移除 interviewer / description / language；P0 仅 5 列 |
