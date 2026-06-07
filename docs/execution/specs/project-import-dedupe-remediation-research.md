# 调研：重复导入 legacy 回填 + hash fast path

> **状态**：已采纳（lifecycle Round 5 补完）  
> **关联架构**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md)

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 旧项目文本文件无 `import_content_sha256`，重复拖入同内容无提示；大项目重复检测对每条 legacy 音频全量 hash，UI 卡顿 |
| 本仓现状 | `import_duplicate.rs` 路径 + 字节 hash；legacy 仅 fallback 读 `audio_path` |
| 成功标准 | legacy 文本 re-import 触发重复对话框；有 provenance 的行不再重复 hash 磁盘音频；对话框 z-index 可预测叠层 |

## 2. 业内路线

| # | 路线 | 机制 |
|---|------|------|
| A | Git / Dropbox | 内容 hash 真源 + size/mtime 作 fast reject |
| B | macOS Finder | 拷贝前先比 size，相同再比 hash |

## 3. 决策

- **Legacy 文本**：迁移时用 DB 语段 canonical fingerprint 回填；检测时对 `.txt/.srt` 额外算 incoming segment fingerprint 与 stored 比对
- **Fast path**：行上已有 `import_content_sha256` 且与 incoming 不等 → 跳过 `audio_path` 全量 hash；新增 `import_source_size/modified_ms` 辅助
- **不做什么**：跨项目 dedupe、VTT 解析、异步后台 hash

## 4. 落位

- Rust：`import_duplicate.rs`、`db.rs` migrate/backfill、`project_create_cmd.rs` INSERT
- UI：`config/dialogStack.ts` + gate/modal z-index
