# 轮次 1 审查报告：项目生命周期链路

## 审查范围

**前端**：`useProjectController.ts`, `useProjectLifecycleController.ts`, `useProjectSaveController.ts`, `useSegmentMutationController.ts`, `useProjectEditorState.ts`, `useProjectCloseGateController.ts`

**后端**：`db.rs`, `project_create_cmd.rs`, `project/mod.rs`, `project/utils.rs`, `segment_cmd.rs`

**测试**：vitest 908 passed ✅ | cargo test 288 passed, 1 failed ❌

---

## 缺陷清单

### P1 — 高优先级

#### 1.1 `import_audio_to_project` 未使用数据库事务
**位置**：`apps/desktop/src-tauri/src/project/project_create_cmd.rs:188-226`

```rust
// 问题代码：
conn.execute("INSERT INTO files ...")?;  // ①
conn.execute("UPDATE projects ...")?;    // ②
```

**问题**：`copy_audio_with_context` → `canonicalize_audio_storage_path` → `INSERT files` → `UPDATE projects` 四步操作不在事务中。如果第①步成功但第②步失败（或进程在第①步后崩溃），数据库中只有 files 记录但没有 projects 的 updated_at 更新，音频文件已复制但元数据不完整。

**修复建议**：
```rust
let mut conn = open_db(st)?;
let tx = conn.transaction().map_err(|e| e.to_string())?;
tx.execute("INSERT INTO files ...", ...)?;
tx.execute("UPDATE projects ...", ...)?;
tx.commit()?;
```

#### 1.2 `create_empty_text_file` 未使用事务
**位置**：`apps/desktop/src-tauri/src/project/project_create_cmd.rs:164-185`

同样的问题：`INSERT files` 和 `UPDATE projects` 是独立的 `execute` 调用。

#### 1.3 `project_create_from_audio` 提交后 `project_detail_from_conn` 失败导致不一致
**位置**：`apps/desktop/src-tauri/src/project/project_create_cmd.rs:79-81`

```rust
tx.commit()?;
allow_imported_audio_asset(&app, &dest_audio);
project_detail_from_conn(&conn, &project_id)  // 如果失败，文件已复制、DB已提交
```

`project_detail_from_conn` 失败概率低，但如果发生，前端会收到错误但项目实际上已创建。

#### 1.4 数据库缺少 WAL mode
**位置**：`apps/desktop/src-tauri/src/db.rs:230`, `apps/desktop/src-tauri/src/project/utils.rs:42-48`

```rust
// 当前只设置了：
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
// 缺少：
PRAGMA journal_mode = WAL;
```

**影响**：没有 WAL 模式时，写入操作会锁定整个数据库文件。如果在转写大任务时并行执行保存，可能导致"database is locked"错误。WAL 模式是 SQLite 桌面应用的标准配置。

#### 1.5 `useSegmentMutationController.ts` 超过 300 行阈值
**位置**：`apps/desktop/src/pages/useSegmentMutationController.ts` — 360 行

AGENTS.md 规定：hook > 300 行应拆分。

#### 1.6 `bundled_asr_assets.rs` 资源路径在测试环境下返回错误路径
**位置**：`apps/desktop/src-tauri/src/project/transcribe_timeout.rs` 测试失败

```
left:  ".../target/debug/resources/bundled-asr/..."
right: ".../src-tauri/resources/bundled-asr/..."
```

`candidate_resource_roots_from_parts` 在 cargo test 环境下将 `target/debug/resources` 作为优先路径，但测试期望的是源码树路径。

---

### P2 — 中优先级

#### 2.1 前端 mega-hook 重渲染问题
**位置**：`useProjectController.ts`

232 行 hook 返回 200+ 字段的对象。任何子 controller 的状态变化（如 `asrHealth` 更新）都会重建整个对象，导致 `ProjectPanel` 和所有子组件重渲染。

**分析**：这是刻意设计的 facade 模式，但缺少 selector/subscription 优化。行业最佳实践是：大对象拆分为独立的状态片段，或使用 `React.memo` + 细粒度 props。

#### 2.2 `closeGateRef` 在 render 中直接赋值
**位置**：`useProjectLifecycleController.ts:187`

```typescript
closeGateRef.current = closeGate;  // 在 render 阶段直接修改 ref
```

React StrictMode 下会 double-render，虽然对 ref 的影响通常可接受，但这是不推荐的做法。应使用 `useEffect`。

#### 2.3 `saveSegments` 中 `setCurrent` 的乐观更新逻辑
**位置**：`useProjectSaveController.ts:107-111`

```typescript
setCurrent((prev) =>
  prev?.id === projectDetail.id && prev.updated_at_ms === projectDetail.updated_at_ms
    ? prev
    : projectDetail,
);
```

如果 `projectLoad` 返回的 `updated_at_ms` 与之前相同（由于精度问题或并发），`setCurrent` 不会更新，但 `files` 列表可能已变化（其他文件被修改）。这会导致前端状态与后端不一致。

#### 2.4 `remove_audio_file` 目录清理 race condition
**位置**：`apps/desktop/src-tauri/src/project/utils.rs:166-193`

```rust
if entries.next().is_none() {
    let _ = fs::remove_dir(parent);
}
```

`read_dir` + `next()` 不是原子操作。如果在检查和删除之间有其他文件被创建，会删除非空目录（在 Unix 上 `remove_dir` 会失败，但错误被忽略）。

#### 2.5 `db.rs` 556 行，接近 AGENTS.md 阈值
AGENTS.md: `.rs > 500 行 → 考虑拆模块`。`db.rs` 包含 schema + 10 个迁移函数 + 12 个测试，应拆分为 `db/schema.rs` 和 `db/migrations.rs`。

---

### P3 — 低优先级

#### 3.1 `useProjectController.ts` 缺少类型导出
第 10 行 `export type ProjectControllerApi = ReturnType<typeof useProjectController>;` 导出了大 union 类型，但内部字段没有细粒度类型。测试时需要 mock 整个 200+ 字段对象。

#### 3.2 `append_desktop_log_line` 的 10MB 轮转不够灵活
如果用户连续使用数天，可能丢失早期日志。行业通行是：保留 3-5 个轮转文件。

---

## 动态模拟结果

| 测试 | 结果 | 备注 |
|------|------|------|
| vitest (908 tests) | ✅ 全部通过 | — |
| cargo test (288 tests) | ❌ 1 失败 | `transcribe_timeout::resolve_ffprobe_prefers_bundled_when_present` |
| `check-architecture-guard.mjs` | 待运行 | — |

---

## 修复优先级

| 优先级 | 事项 | 文件 |
|--------|------|------|
| P1 | `import_audio_to_project` 添加事务 | `project_create_cmd.rs` |
| P1 | `create_empty_text_file` 添加事务 | `project_create_cmd.rs` |
| P1 | 数据库启用 WAL mode | `db.rs` / `utils.rs` |
| P1 | 修复 `resolve_ffprobe_prefers_bundled_when_present` 测试 | `bundled_asr_assets.rs` |
| P1 | 拆分 `useSegmentMutationController.ts` | `useSegmentMutationController.ts` |
| P2 | `remove_audio_file` 原子目录清理 | `utils.rs` |
| P2 | `saveSegments` 乐观更新修正 | `useProjectSaveController.ts` |
| P2 | 拆分 `db.rs` | `db.rs` → `db/schema.rs` + `db/migrations.rs` |
