# 代码深度审查（2026-05-21）

分批次审查 Rushi 桌面端 + ASR 侧车，按用户旅程模拟链路，输出可跟踪问题表。

## 索引

| 批次 | 文档 | 状态 |
|------|------|------|
| 0 | [batch-0-inventory.md](./batch-0-inventory.md) | 完成 |
| 1 | [batch-1-data-layer.md](./batch-1-data-layer.md) | 完成 |
| 2 | [batch-2-lifecycle.md](./batch-2-lifecycle.md) | 完成 |
| 3 | [batch-3-segments-waveform.md](./batch-3-segments-waveform.md) | 完成 |
| 4 | [batch-4-asr-sidecar.md](./batch-4-asr-sidecar.md) | 完成 |
| 5 | [batch-5-export-import.md](./batch-5-export-import.md) | 完成 |
| 6 | [batch-6-online-stt.md](./batch-6-online-stt.md) | 完成 |
| 7 | [batch-7-editor-ui.md](./batch-7-editor-ui.md) | 完成 |
| 8 | [batch-8-architecture-debt.md](./batch-8-architecture-debt.md) | 完成 |

**统一问题表**：[issues.md](./issues.md)

**拆分设计方案**：[architecture-split-plan.md](../specs/architecture-split-plan.md)

**链路模拟**：

- [chains/project-load-transcribe-save.md](./chains/project-load-transcribe-save.md)
- [chains/segment-edit-undo.md](./chains/segment-edit-undo.md)
- [chains/asr-sidecar-transcribe.md](./chains/asr-sidecar-transcribe.md)

## 验证快照（审查日）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

- typecheck：通过
- 前端 test：117 passed
- 架构守卫：0 错误，8 警告
- Rust test：29 passed

## 与历史文档关系

- [code-review-fix-2025-05-24.md](../specs/code-review-fix-2025-05-24.md) — P0 删文件问题已修；P1–P4 部分落地
- [code-review-report-2026-05-12.md](../../code-review-report-2026-05-12.md) — 全仓四轮报告；多项已在 `project/*` 重构后修复，见各 batch 备注
- [file-container-refactor.md](../specs/file-container-refactor.md) — **转写命令仍用 `project_id` 冒充 `file_id`，属未完成切片**

## 优先修复建议（Top 5）

1. ~~**R2-001**~~ — 已修：`file_id` 贯穿 Rust + 前端
2. ~~**R2-002**~~ — 已修：转写后 `projectLoad` + `openFile`
3. ~~**R3-001**~~ — 已删 `projectSaveSegments`
4. ~~**R1-002**~~ — `project_delete` 先删 DB，FS 尽力清理
5. ~~**R2-003**~~ — 关闭/切换项目或文件前未保存确认
