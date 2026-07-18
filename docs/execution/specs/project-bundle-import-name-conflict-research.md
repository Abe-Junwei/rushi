# 调研：内容包导入文件重名冲突决策

> **状态**：已采纳（2026-07-18）  
> **关联**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) 换机/导入；Plan：内容包导入文件重名冲突决策  
> **门禁**：未完成本文不得进入业务编码（见 [`AGENTS.md`](../../../AGENTS.md)）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 欢迎页 / 编辑器「导入内容包」时，包内文件显示名与库内已有文件同名 → 不应直接失败，应让用户选择：取消导入 / 覆盖现有 / 重命名要导入的内容 |
| 本仓现状 | `import_project_bundle`（[`export_cmd.rs`](../../../apps/desktop/src-tauri/src/project/export_cmd.rs)）→ `import_project_from_parts`（[`project_bundle_cmd.rs`](../../../apps/desktop/src-tauri/src/project/project_bundle_cmd.rs)）按包内 `file_name` 原样 INSERT；`idx_files_name_unique` 全库唯一（[`files.rs` migration](../../../apps/desktop/src-tauri/src/db/migrations/files.rs)）；建项/导入音频走 [`unique_file_name`](../../../apps/desktop/src-tauri/src/project/file_name_unique.rs)，内容包未走 → UNIQUE 硬失败 |
| 成功标准 | 同名冲突弹窗；取消无新项目；覆盖后旧文件消失且新包持原名；重命名后以建议/自定义名导入；无冲突仍一键导入 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | OS 文件替换三选一 | macOS Finder / Windows 资源管理器 | 停止 / 替换 / 保留两者（自动改名） | 系统级复制冲突对话框 |
| B | 预览 + 逐条决议后应用 | 本仓词表包 | `lexicon_bundle_import_preview` → UI → `lexicon_bundle_import_apply(resolutions)` | [`lexicon_bundle_cmd.rs`](../../../apps/desktop/src-tauri/src/project/lexicon_bundle_cmd.rs)、[`LexiconBundleImportDialog.tsx`](../../../apps/desktop/src/components/glossary/LexiconBundleImportDialog.tsx) |
| C | 内容哈希重复提示 | 本仓媒体导入 | 取消 / 打开已有 / 仍要导入（复制） | [`DuplicateImportConfirmDialog.tsx`](../../../apps/desktop/src/components/DuplicateImportConfirmDialog.tsx) — **语义不同**（非显示名 UNIQUE） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A Finder 三选一 | 高（UX） | 取消 / 覆盖 / 改名语义 | 无 | 轻量对话框 |
| B 词表 preview/apply | 高 | 命令拆分、FE controller 模式、`compactDialog` | 无；勿复用词表 choice 枚举 | 解压读 manifest 一次；apply 再读 zip |
| C 媒体重复 | 低 | DialogOverlay / busy 纪律 | 「仍要导入」会再插一条 → 仍撞 UNIQUE | 不适用 |

**本仓已有可复用模块**：

- `name_taken` / `unique_file_name`（全库显示名）
- `delete_file`（覆盖前释放占用）
- 词表包 preview → apply 两段式
- `ImportExchangeBundleResult`（整库部分失败 toast）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **B + A**：pick → preview 文件名冲突 → 用户决议 → apply；覆盖=删既有文件后原名导入；重命名=改写入显示名（默认 `unique_file_name`） |
| 不做什么 | 不静默自动改名；不改全局 UNIQUE；不套媒体「内容重复」对话框；不因项目名重复拦截（项目名本就不唯一） |
| 与 ADR / architecture 关系 | 延续 R3 `files.name` 全局唯一；换机导入见 lifecycle |
| 风险 | 覆盖跨项目破坏性 → 对话框必须展示「项目名 · 文件名」；整库包一次汇总冲突 |

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust | `export_cmd` / `project_bundle_cmd` / `library_bundle_cmd`：preview + apply + resolutions | 新命令 + 改导入路径 |
| UI | 冲突对话框 + `useExportController` | 新组件 / 接线 |
| 测试 | Rust 冲突测；FE 对话框/controller | 新增 |
| 文档 | 本文 + lifecycle 一行 | 更新 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] Plan 已链接本文
- [x] 可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版采纳 |
