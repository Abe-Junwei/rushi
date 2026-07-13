# 调研：跨项目复制文件（深拷贝）

> **状态**：已采纳  
> **关联**：五项文件操作薄片（打开位置 / 自动改名 / 复制 / 拖拽 / 批量）  
> **门禁**：语义以本文 §4 为准后编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 文件右键「复制到…」生成独立副本；源保留；可同项目「创建副本」。 |
| 本仓现状 | 仅有 `move_file_to_project`（改 `project_id` + 搬盘）；无 copy。 |
| 成功标准 | 目标出现新 `file_id`；改目标语段不影响源；托管 audio 为两份。 |

关键：`file_cmd.rs`、`project_storage.rs`、`useProjectFileMutationController.ts`、菜单 model。

---

## 2. 业内对照

| # | 路线 | 代表 | 要点 |
|---|------|------|------|
| A | 深拷贝资源 | Finder 复制到文件夹 | 新 inode + 元数据副本 |
| B | 引用计数 / 硬链 | 部分 DAM | 省盘；编辑互相影响 → **不适合**编辑型转写 |

---

## 3. 可复用评估

| 路线 | 复用度 | 说明 |
|------|--------|------|
| A | 高 | 新 file/segment id；`fs::copy` audio+peaks；对称 move 的 relocate |
| move + unique name | 高 | 同名策略与 move 共用 `unique_file_name`（全库） |

**不做什么**：浅拷贝共享磁盘当两份编辑；复制 edit log；覆盖目标同名。

---

## 4. 决策

| 问题 | 结论 |
|------|------|
| 语义 | 深拷贝：新 `files` 行 + 新 `segments` 行；托管 audio/peaks **拷贝**不删源 |
| 外部路径 | 仅新 DB 行指向同一 `audio_path`（不强制再拷一份） |
| 同名 | **全库全局唯一**：任意项目间不可同名；目标/源占用时自动 `name (2).ext` |
| 同项目 | `dest == source` 允许（创建副本） |
| API | `copy_file_to_project(file_id, dest) -> { new_file_id, final_name }` |

---

## 5. 落位预告

| 层 | 模块 |
|----|------|
| Docs | 本文 |
| Rust | `copy_file_to_project` + `copy_file_storage_between_projects` |
| TS/UI | fileApi、mutation confirm、菜单「复制到…」 |

---

## 6. 签收

- [x] 调研 brief 完成（与五项计划一并采纳）
