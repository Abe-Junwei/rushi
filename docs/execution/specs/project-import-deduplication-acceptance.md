# Acceptance: 项目文件生命周期 — 导入去重 / Close Gate / Hub CRUD

> **Research**：[`project-import-dedupe-remediation-research.md`](./project-import-dedupe-remediation-research.md)  
> **Architecture**：[`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md)  
> **状态**：Phase 6 自动闸门 ✅ · 手测待签收（2026-06-06）

---

## 总闸门（Phase 6 · 2026-06-06）

- [x] `npm run typecheck` — pass
- [x] `npm run test` — **1002 passed**（含 lifecycle 16 条 + Stage B 2 条修复）
- [x] `node scripts/check-architecture-guard.mjs` — **0 错误** / 43 警告（含 `import_duplicate.rs`、`useProjectCloseGateController.ts` 行数，Phase 9 结构债）
- [x] `cargo test import_duplicate --lib` — **5 passed**

---

## 自动验收

| 区域 | 测试 |
|------|------|
| Close Gate | `useProjectCloseGateController.test.ts` — 换项目 unsaved、Hub reload、import 后 open newest、转写→未保存链 |
| 导入去重 UI | `useProjectImportDuplicateController.test.ts` — 检测期不 busy、确认后 import、打开已有、busy toast |
| 去重纯函数 | `projectImportDuplicate.test.ts` |
| Rust 去重 | `import_duplicate.rs` — 路径/内容/legacy 文本/backfill/skip rehash |

---

## 能力—UI 状态矩阵

| UI / 动作 | 条件 | 预期 |
|-----------|------|------|
| 重复导入对话框 | 路径重复 | **立即**弹出（不先全屏 hash）；检测中显示轻量「正在检测…」 |
| 重复导入三按钮 | 对话框打开 | **可点击**（不受全局 `busy` 禁用） |
| 仍要导入 | 确认后 | `beginBusy(import)` → 导入 → `loadProjectAfterImport` 打开最新文件 |
| 打开已有 | 确认 | `openFileWrapped`，不复制 |
| Hub 导入 | `currentFileId === null` | 导入后打开最新文件 |
| 编辑器内导入 | 有当前文件 | 导入后打开最新文件（经 open 闸门） |
| Hub 点同一项目 | 在文件列表 | 仅刷新列表，**不**自动进编辑器 |
| Hub 删/改名 | — | `refreshProjectHub`，不 `openFile` |
| 关窗 | 仅转写 | `TranscribeNavBlockDialog` |
| 关窗 | 转写 + 未保存 | 转写闸门 → 停止后 **未保存** 闸门 |
| 编辑器面包屑 | 未保存语段 | saffron ● |

---

## 手测清单

> Agent 无法替代桌面 UI 手测。请在本地 `npm run dev -w @rushi/desktop` 后逐条勾选；全部 ✅ 即 Phase 6 签收完成。

### 重复导入

- [ ] 同一路径再导入 → 对话框秒出，取消 / 打开已有 / 仍要导入均可点
- [ ] 「仍要导入」→ 新项目文件出现在列表并打开
- [ ] 「打开已有」→ 进入已有文件，无新副本

### Close Gate

- [ ] 编辑器未保存 → 关文件 / 换项目 / 换文件 → `UnsavedCloseDialog`
- [ ] 转写中 → 回 Hub → `TranscribeNavBlockDialog`；停止后若仍有未保存 → 未保存对话框
- [ ] 转写中无未保存 → 关窗 → 转写拦截对话框

### Hub CRUD

- [ ] 重命名 inline → 列表刷新，停留 Hub
- [ ] 删除文件 → 确认后列表刷新；若删最后一个 → 空项目态

### 批量拖放（空项目）

- [ ] 多文件拖入 → 全部导入完成后打开**最新**一个

---

## 非目标（本薄片不做）

- [ ] 跨项目 dedupe
- [ ] 批量拖放 Skip all / Import all
- [ ] Replace / Relink 媒体
- [ ] VTT 专用解析

---

## 提交前

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test import_duplicate --manifest-path apps/desktop/src-tauri/Cargo.toml --lib
```
