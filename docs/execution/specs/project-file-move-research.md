# 调研：项目列表右键 + 文件跨项目移动

> **状态**：已采纳  
> **关联**：侧栏「项目列表」交互补齐；Plan `move_file_context_menu`  
> **门禁**：语义以本文 §4 为准后编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 侧栏项目/文件行右键完成打开、重命名、删除、展开；文件可「移动到其他项目」。 |
| 本仓现状 | 侧栏仅单击打开 + 行内删除/展开；Hub 文件有悬停重命名/删除；**无** `move_file`；音频/peaks 在 `projects/{project_id}/`。 |
| 成功标准 | 右键菜单可完成 P0 动作；移动后源列表无此文件、目标列表有，语段保留；打开中移动走 close gate。 |

关键路径：

- UI：`WorkspaceProjectLibrary.tsx`、`ProjectFilesHubFileList.tsx`、`SegmentContextMenu.tsx`
- 写路径：`file_cmd.rs`、`project_storage.rs`、`waveform_peaks.rs`
- Controller：`useProjectFileMutationController.ts`、`useProjectMutationController.ts`

---

## 2. 业内对照

| # | 路线 | 代表 | 要点 |
|---|------|------|------|
| A | 资源归属 + 物理搬迁 | Finder / VS Code workspace | 改父容器时一并搬磁盘路径 |
| B | 仅改元数据指针 | 部分云盘「收藏夹」 | 适合软链接；本仓 peaks/audio 按项目目录隔离 → **不适用单独改 DB** |

---

## 3. 可复用评估

| 路线 | 复用度 | 说明 |
|------|--------|------|
| A | 高 | 新建 `move_file_to_project`：DB `project_id` + 搬 audio/peaks |
| SegmentContextMenu | 高 | 已有 submenu / portal / clamp |
| rename/delete controllers | 高 | 直接挂菜单，不重写 |

**不做什么**：复制到项目、拖拽、多选批量、真实 OS 文件夹树、自动同名改名。

---

## 4. 决策

| 问题 | 结论 |
|------|------|
| 菜单范围 | **项目行**：打开、展开/收起、重命名、删除。**文件行**（侧栏+Hub）：打开、移动到…（子菜单）、重命名、删除 |
| 目标选择 | 子菜单列其他项目；仅一项目时「移动到…」disabled |
| 确认 | CompactConfirm 确认移动；删除沿用现有确认 |
| 打开中文件 | close gate → 关文件 → move；停留源项目 Hub，刷新源+目标列表 |
| 同名 | **全库全局唯一**（`unique_file_name`）；占用时自动 `name (2).ext`（已从「目标错误」升级） |
| 磁盘 | 源 `projects/{src}/` 下的 audio + peaks 迁到目标目录并更新 `audio_path`；外部路径仅改 DB |

---

## 5. 落位预告

| 层 | 模块 |
|----|------|
| Docs | 本文 |
| Rust | `file_cmd::move_file_to_project` + peaks relocate helper |
| TS | `fileApi.moveFileToProject`、file/project context menu models、mutation controller |
| UI | `WorkspaceProjectLibrary`、`ProjectFilesHubFileList` + CompactConfirm |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 与用户确认可进入编码（Plan 已采纳 +「与先前建议一起实现」）

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 初版：P0 右键 + 跨项目移动 |
