# 代码审查修复方案 — 2025-05-24

## 审查范围

| 模块 | 文件 |
|------|------|
| 欢迎页 UI | `WelcomeView.tsx`, `WelcomeSidebar.tsx`, `WelcomeTopBar.tsx` |
| 项目面板 | `ProjectPanel.tsx`, `ProjectHeader.tsx` |
| 前端控制器 | `useProjectLifecycleController.ts`, `useProjectCrudController.ts` |
| Rust 数据层 | `project_cmd.rs`, `utils.rs`, `types.rs` |

---

## 问题清单

### P0 — 数据安全 Bug（已修复 ✅）

| # | 文件 | 问题 | 影响 |
|---|------|------|------|
| P0-1 | `project_cmd.rs::delete_file` | 调用 `remove_project_audio_parent_dir` 删除音频文件的**父目录**（即整个项目目录），导致同项目其他文件的音频被一并删除 | 删除一个文件时，项目内其他文件的音频丢失 |
| P0-2 | `project_cmd.rs::project_delete` | 遍历所有音频路径并对每个路径调用 `remove_project_audio_parent_dir`；第一次调用后目录已不存在，第二次迭代报错，导致 DB 记录未清理 | 项目删除失败，文件系统与数据库状态不一致 |

**修复方案：**
- 新增 `remove_audio_file()` 函数：仅删除单个音频文件，若目录变空则清理空目录
- `delete_file` 改用 `remove_audio_file()` 而非 `remove_project_audio_parent_dir()`
- `project_delete` 只对第一个音频路径调用 `remove_project_audio_parent_dir()`（所有文件共享同一目录），无音频时清理空项目目录

**验证：** `cargo test` 29 passed, `cargo clippy --all-targets -- -D warnings` 0 errors

---

### P1 — 架构守卫阈值

| # | 文件 | 问题 | 阈值 |
|---|------|------|------|
| P1-1 | `useProjectLifecycleController.ts` | 366 行 / 16 hooks | 300 行 / 12 hooks |
| P1-2 | `WelcomeSidebar.tsx` | 365 行 | 300 行 |
| P1-3 | `project_cmd.rs` | 887 行 | 500 行（.rs 模块建议值） |

**修复方案：**
- `useProjectLifecycleController.ts`：将状态管理拆分为 2-3 个独立 hook
  - `useProjectListState`：项目列表 + CRUD
  - `useProjectFileState`：当前项目/文件 + segments + audio
  - `useProjectBusyState`：busy/error/计时器
- `WelcomeSidebar.tsx`：将最近项目列表提取为 `RecentProjectList.tsx`（<150 行）
- `project_cmd.rs`：将命令按领域拆分为子模块（`file_cmd.rs`, `segment_cmd.rs`）— 本轮不实施，记为技术债

**验证：** `node scripts/check-architecture-guard.mjs` 0 错误

---

### P2 — 功能链路 Bug

| # | 文件 | 问题 | 影响 |
|---|------|------|------|
| P2-1 | `useProjectLifecycleController.ts::loadProject` | 先 `applyDetail(d)` 再 `openFile(sorted[0].id)`；若 `openFile` 失败，UI 处于「项目已加载但无文件」的半加载状态 | 用户看到项目名但无内容，状态不一致 |
| P2-2 | `useProjectLifecycleController.ts` | `runTranscribe`, `saveSegments`, `createProject`, `deleteProject` 等无 `busy` guard | 双击可触发重复操作，可能导致数据竞争或重复请求 |
| P2-3 | `useProjectLifecycleController.ts::refreshCurrentProject` | 仅重载项目元数据，不刷新当前打开文件的 segments/audio | 外部修改后 UI 显示旧数据 |
| P2-4 | `useProjectLifecycleController.ts::closeProject` | 直接调用 `closeFile()` → `resetMutationHistory()`，丢弃未保存修改，无确认 | 用户误操作丢失工作 |

**修复方案：**
- P2-1：`loadProject` 使用 try/catch，若 `openFile` 失败则回滚 `current` 状态
- P2-2：所有异步操作入口添加 `if (busy) return` guard
- P2-3：`refreshCurrentProject` 成功后，若 `currentFileId` 存在则连带调用 `loadFile`
- P2-4：`closeProject` 前检查 `hasUnsavedChanges`，若有则弹出确认对话框

**验证：** 定向测试 + 手测主路径

---

### P3 — 代码质量

| # | 文件 | 问题 |
|---|------|------|
| P3-1 | `WelcomeTopBar.tsx` | `UserAvatar` 硬编码 Google 图片 URL |
| P3-2 | `WelcomeTopBar.tsx` | `StatusDot` 使用 `bg-green-500` 而非 design token |
| P3-3 | `types.rs` | `HTTP_CLIENT` 静态变量放在数据类型模块中，耦合不当 |
| P3-4 | `types.rs` | `AUDIO_ONLY` 常量定义但从未使用 |
| P3-5 | `ProjectPanel.tsx` | `onlineSttFocusSeq` 死常量（始终为 0） |
| P3-6 | `workspace.css` | 硬编码颜色（architecture guard 报告） |

**修复方案：**
- P3-1：移除外部 URL，改用纯色占位头像
- P3-2：`bg-green-500` → `bg-zen-success`
- P3-3：将 `HTTP_CLIENT` 移至 `utils.rs` 或新建 `http.rs`
- P3-4：已标记 `#[allow(dead_code)]`，本轮保留
- P3-5：移除死常量或完成功能
- P3-6：将硬编码颜色映射为 tailwind token

---

### P4 — 交互/可访问性

| # | 文件 | 问题 |
|---|------|------|
| P4-1 | `WelcomeSidebar.tsx` | 点击项目名同时触发「展开文件列表」和「加载项目」，两个动作捆绑 |
| P4-2 | `WelcomeSidebar.tsx` | 删除确认无键盘 Escape / 点击外部取消 |
| P4-3 | `WelcomeSidebar.tsx` | 操作按钮仅靠 `group-hover` 显示，键盘用户无法访问 |
| P4-4 | `WelcomeSidebar.tsx` | `ensureProjectFilesLoaded` callback 依赖对象（`loadingFilesById`, `projectFilesById`）导致频繁重建 |

**修复方案：**
- P4-1：分离为两个独立操作 — 点击项目名仅加载项目，点击展开箭头仅展开/收起
- P4-2：添加 `Escape` 键盘监听和点击外部取消
- P4-3：操作按钮始终可见（缩小为图标按钮），hover 仅改变颜色
- P4-4：使用 ref 或稳定 key 替代对象依赖

---

## 实施顺序

```
Round 1（当前）: P0 Rust Bug 修复 → 验证通过 ✅
Round 2: P2-2 busy guards + P2-1 半加载回滚 + P3 代码质量
Round 3: P1 架构拆分（lifecycle controller → 子 hook）
Round 4: P4 交互改进 + P2-3/P2-4 状态管理完善
Round 5: P1 WelcomeSidebar 拆分 + 最终验证
```

## 每轮验证命令

```bash
# Rust
 cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
 cargo clippy --all-targets -- -D warnings

# Frontend
 npm run typecheck
 npm run test
 npm run lint
 node scripts/check-architecture-guard.mjs
```

---

## 技术债登记

| 项 | 原因 | 计划 |
|----|------|------|
| `project_cmd.rs` 887 行 | 命令过多，拆模块影响面大 | 下轮专门重构，拆为 `file_cmd.rs` / `segment_cmd.rs` |
| `useProjectLifecycleController.ts` 无测试 | 366 行 mega-hook，测试成本高 | 拆分为子 hook 后补测试 |
| `export_cmd.rs` 485 行 | AI_QUICKSTART 已标记为待拆 | 与 `project_cmd.rs` 重构同期处理 |

---

## 本轮执行记录（2026-05-25）

### 已完成

- ✅ Lucide 图标尺寸规范落地（14 / 18 / 20 三档）
  - 新增共享规范：`apps/desktop/src/components/lucideIconSpec.ts`
  - 组件层 Lucide 图标统一改为：`LUCIDE_ICON_SIZE_SM|MD|LG` + `LUCIDE_ICON_STROKE_WIDTH`
- ✅ 架构守卫新增 Lucide 防回退规则（`scripts/check-architecture-guard.mjs`）
  - 使用 `lucide-react` 时必须引入 `lucideIconSpec`
  - 禁止 `strokeWidth={2}` 等非规范写法，必须使用 `LUCIDE_ICON_STROKE_WIDTH`
  - 禁止在 Lucide 标签上硬编码尺寸对（`h-3.5 w-3.5` / `h-[18px] w-[18px]` / `h-5 w-5`）
- ✅ 设计文档补充图标规范（`DESIGN.md`）

### 验证

- `node scripts/check-architecture-guard.mjs`：0 错误
- `npm run typecheck`：通过
