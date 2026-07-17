# 调研：自包含项目包（不依赖网盘换机）

> **状态**：已采纳（2026-07-17 用户要求「把没有的内容一起打包进去，因为不放网盘」）  
> **关联**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md)（媒体可上网盘；本片覆盖**不放网盘**时的项目级交换）  
> **验收**：[`project-bundle-self-contained-acceptance.md`](./project-bundle-self-contained-acceptance.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户不把媒体放网盘；换机需一份 zip 带走「能打开、能播、能继续改」的项目。 |
| 本仓现状 | Bundle v1：`manifest.json` + `project.json`（单文件语段）+ `audio/{leaf}`；导出绑定 `currentFileId`；相对 `audio_path` 未走 `resolve_audio_path`。缺：多文件音轨、peaks、项目元数据、edit_log。 |
| 成功标准 | 多文件项目导出后，在空库机器导入：全部音轨可播、语段齐全、peaks 可立刻显示（若导出时已有）；v1 zip 仍可导入。 |

## 2. 业内对照（≥2）

| # | 路线 | 代表 | 要点 |
|---|------|------|------|
| A | 自包含工程包 | DaVinci Resolve `.drp` / Premiere 项目归档 | 媒体 + 时间线进包或显式 collect；换机不依赖外部盘符 |
| B | 库与媒体二分 | Zotero（DB 本地 + 附件可同步） | 本仓已选；**不放网盘**时退化为「单项目 collect into zip」 |
| C | 仅元数据包 | 部分字幕工具只导 SRT | 不够；用户明确要音频等一并带走 |

**选定 A 风格的项目级 collect**：升级 bundle **v2**，仍非整库迁移。

## 3. 可复用评估

| 路线 | 复用度 | 本仓模块 | 冲突 |
|------|--------|----------|------|
| A 自包含 zip v2 | 高 | `project_bundle_cmd`、`resolve_audio_path`、`peaks_dir` / `PEAK_LEVELS`、`open_db` 语段查询 | 包体积↑；须保留 v1 导入 |
| 整库拷贝 | 低 | — | 与「live DB 不上云」及 WAL 风险冲突；**不做** |

## 4. 决策

**做（v2）**

- 项目下**全部** `files`（有音频的）+ 各文件语段（当前打开文件用前端已 flush 的 snapshot，其余读 DB）
- 各文件 peaks（`.dat` + `.meta.json`，有则打包，无则跳过）
- 项目元数据：`narrator` / `recorded_at` / `location` / `subject` / `transcriber`
- `edit_log` 行（不含 `edit_log_snapshots` 大块快照，避免体积爆炸；可重建编辑体验以语段为准）
- 全局词表：嵌入 `lexicon.json`（复用既有 `rushi_lexicon_bundle`：`glossary_terms` + 稳定 `correction_memory`；导入冲突默认 skip 保留本机）

**不做**

- 整库 SQLite / models / secrets / prefs / 媒体基准
- `edit_log_snapshots` 大块快照、未达稳定阈值的闪法纠错
- 说话人表（当前 schema 无独立 speakers）
- 把 zip 升格为协作真源

## 5. 落位预告

| 层 | 路径 |
|----|------|
| Rust | `project_bundle_cmd.rs`（+ tests）；导出改用 `resolve_audio_path` |
| API | `export_project_bundle` 签名可不变（仍传当前 fileId + segments） |
| 文档 | lifecycle / acceptance |

版本：`PROJECT_BUNDLE_VERSION = 2`；导入分支 v1 / v2。
