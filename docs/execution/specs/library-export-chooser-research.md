# 调研：导出范围选择（当前项目 / 整库）

> **状态**：已采纳（2026-07-17）  
> **验收**：[`library-export-chooser-acceptance.md`](./library-export-chooser-acceptance.md)  
> **关联**：[`project-bundle-self-contained-research.md`](./project-bundle-self-contained-research.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 不放网盘换机；有时只带走当前项目，有时要带走库内全部项目。 |
| 本仓现状 | 仅单项目 `rushi_project_bundle` v2；菜单无范围选择。 |
| 成功标准 | 导出可选两档；整库 zip 在空机导入后项目与词表齐备；不含 models/secrets/live DB。 |

## 2. 业内对照（≥2）

| # | 路线 | 代表 | 要点 |
|---|------|------|------|
| A | 多工程归档包 | Resolve / Premiere project archive | 媒体+时间线进包；非整库 DB |
| B | 应用数据目录拷贝 | 部分桌面工具「备份整个库」 | 含 DB；WAL/密钥风险高 |
| C | 单项目交换（已有） | 本仓 project bundle v2 | 已自包含 |

**选定 A**：`rushi_library_bundle` = 嵌套多个 project v2 + 顶层一份 lexicon。

## 3. 可复用评估

| 路线 | 复用度 | 模块 | 冲突 |
|------|--------|------|------|
| A 多项目 zip | 高 | `export_project_bundle_to_path`、`lexicon_bundle`、compactDialog | 体积↑ |
| B sqlite 快照 | 低 | — | 与「DB 不上云」冲突；**不做** |

## 4. 决策

**做**：UI 范围选择；整库导出/导入；导入入口按 `manifest.kind` 分流。  
**不做**：live SQLite / models / secrets 快照。

## 5. 落位预告

| 层 | 路径 |
|----|------|
| Rust | `library_bundle_cmd.rs` + `export_cmd` |
| UI | `ExportBundleScopeDialog` + `useExportController` / `EditorToolbar` |
