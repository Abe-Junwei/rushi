# Phase 10：项目 Hub 导航 + 项目管理与场次元信息

> **Research**：[project-hub-metadata-research.md](./project-hub-metadata-research.md)  
> **状态**：编码中（2026-06-06）

## 意图

用户在编辑器与文件 Hub 之间需要明确导航；项目级需支持重命名、删除、5 项场次元信息（讲述人/时间/地点/主题/转录人），创建与改名时对重名做软提示。

## 范围

| 薄片 | 交付 |
|------|------|
| 10-A | 编辑顶栏「文件」、面包屑回 Hub、`⌘⇧E` |
| 10-B | `rename_project`、Hub 删/改名、重名软提示 |
| 10-C | DB 迁移 5 列、`update_project_metadata`、Hub「项目信息」对话框 |

## 不做

采访人 / 摘要 / 项目级语言；OHMS 同步；UNIQUE(name)；P1 扩展列（keywords 等）。

## 验证

`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`；`cargo test` 定向 metadata/rename；手测清单见 acceptance。
