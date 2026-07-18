# 调研：欢迎页「所有文件」承接侧栏项目库

> **状态**：已采纳  
> **关联**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) · 计划 `all_files_library_migration`  
> **门禁**：本薄片 UI 迁库；星标仅附录规划，不落持久化

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 在「项目与文件」主区浏览全部项目/文件（展开、打开、重命名、删除、跨项目移动），侧栏只做导航 |
| 本仓现状 | 真树在 `WelcomeSidebar` → `WelcomeSidebarProjectList` + `useWelcomeSidebarProjectTree`；主区 `WelcomeFileLedger`「所有文件 / 星标」disabled；右键真源 `projectWorkspaceContextMenuModel` |
| 成功标准 | 「所有文件」可用且含原侧栏树+右键；三处侧栏无项目树；Hub/编辑器点「项目与文件」回欢迎并选中所有文件；无星标 tab（附录 A 启用时再加） |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | 侧栏导航 + 主区库 | macOS Finder / Windows Explorer | 窄侧栏选位置，主区展示完整库树/列表 | 系统文件管理器 |
| B | 侧栏导航 + 主区页面列表 | Notion / Linear | 侧栏进页面，库内容在主画布 | Notion workspace sidebar |
| C | 项目库常驻侧栏 | VS Code / Descript | 资源树固定在侧栏 | 本仓旧态（迁移前） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A/B | 高 | 与「侧栏导航 + 主区 ledger」一致 | 无 | 无新进程 |
| C | 低（刻意离开） | — | 与产品「主区三 tab」冲突 | — |

**本仓已有可复用模块**（禁止第二套列表）：

- `WelcomeSidebarProjectList` → 抽为 `WorkspaceProjectLibrary`
- `useWelcomeSidebarProjectTree` → `useWelcomeProjectTree`
- `projectWorkspaceContextMenuModel` + `SegmentContextMenu`
- `useSidebarFileProjectDrag` → `useProjectLibraryFileDrag`
- `ProjectControllerApi` CRUD / reveal / move / copy

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 主区「所有文件」挂载现有项目树+右键；侧栏三处移除树；Nav「项目与文件」→ home + tab=all（Hub/编辑器经 `onLeaveProjectForWelcome`） |
| 不做什么 | 星标持久化/启用；第二套项目服务；改 Hero CTA；重做 Hub 文件列表 |
| 与 ADR / architecture | 对齐 lifecycle 欢迎页 ledger；Hub 文件右键仍用同一 menu model |
| 风险 | Hub 侧栏变空——已确认可接受；切项目须回库 |

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI | `WelcomeFileLedger`、`WorkspaceProjectLibrary`、`WelcomeView`、`WelcomeSidebar*` | 迁库 / 去树 |
| Hook | `useWelcomeProjectTree`、`useProjectLibraryFileDrag` | 改名 + 去 hub 自动展开 |
| 文档 | lifecycle + 本文 | 真源更新 |
| 测试 | ledger / library focused | 更新 |

---

## 附录 A — 星标 tab 启用规划（本薄片不做）

| 项 | 建议 |
|----|------|
| 对象 | **文件优先**（与「最近文件」同质）；项目星标可后续 |
| 存储 | SQLite `files.is_starred`（或 `stars` 表）+ Tauri toggle；禁止仅 localStorage 当真源 |
| UI | 启用「星标」tab；空态；右键「加星标/取消」；ledger 行星标图标 |
| 本薄片 | **已移除**星标 tab（2026-07-18）；启用时再加回 |

---

## 附录 B — Hub 动作迁入库（2026-07-18）

| 项 | 结论 |
|----|------|
| 落位 | `WorkspaceProjectLibrary` 展开区 `ProjectLibraryActionBar` + 扩展项目右键 |
| 点击项目 | 仅展开/收起，不 `loadProject` 进旧 Hub 页 |
| 壳 | `hub` variant → `WelcomeView`（所有文件 + 自动展开 current）；`ProjectHubView` 源码保留未接线 |
| 动作 | 导入音频/文本、批量转写、项目信息；文件行 hover 重命名/删除 |
| 后续 | 删除 `ProjectHubView` / Hub 面板文件；拖放导入可再迁 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 用户确认：Hub/编辑器整树移除；星标保持 disabled
- [x] Hub 动作迁库（附录 B）已编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-18 | 初版（已采纳） |
| 2026-07-18 | 附录 B：Hub 动作迁入所有文件列表 |
