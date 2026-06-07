# Plan：语段编辑阶段（S1–S3）

> **Research**：[`segment-edit-stage-indicator-research.md`](./segment-edit-stage-indicator-research.md)  
> **Intent**：[`segment-edit-stage-indicator-intent.md`](./segment-edit-stage-indicator-intent.md)

## 1. 竞品落地对照（摘要）

| 产品 | 落位 | 确认动作 | 与 Rushi 取舍 |
|------|------|----------|---------------|
| **Trint** | 段右 checkbox → 绿 + 顶栏计数 | 点击勾选 | 仅二态；Rushi 四态 + 只读 badge |
| **memoQ** | 独立 status 列 + 底色 | **Ctrl+Enter** 确认；Edited 与 Confirmed 分离 | 对齐：Edited≈手动转写，Confirmed≈定稿 |
| **LILT** | 段左 ✓ / ✓✓ | 译员确认 / 审校确认 | 多角色 v1 不做 |

memoQ 要点：**自动保存 ≠ 确认**；确认才进 TM（≈ Rushi 纠错记忆）。Rushi **标记定稿** 零 diff 路径不写记忆，对标 memoQ `Ctrl+Shift+Enter` 无 TM 确认变体。

## 2. 边界情况矩阵

| # | 场景 | 期望 stage | 备注 |
|---|------|------------|------|
| B1 | 转写落库 | 全段 `auto_transcribe` | Rust 写默认 / 显式字段 |
| B2 | 智能改稿写回且文本变 | 该段 `ai_revised` | 清空 `finalize_via` |
| B3 | 写回但文本不变 | 保持原 stage | |
| B4 | 手改 + 自动保存/⌘S | `manual_transcribe` | 非 finalize 路径 |
| B5 | 编辑中 draft 未落库 | 原 stage + 圆点 | 不提前 `manual_transcribe` |
| B6 | ⌘Enter / 右键定稿 + 有 draft | `finalized` + `confirm_edit` + 记忆 | |
| B7 | ⌘Enter / 右键定稿 + 无 draft | `finalized` + `mark_only` | AI改稿零手改 |
| B8 | 已定稿 + 再手改落库 | `manual_transcribe` | 自动降级 |
| B9 | 已定稿 + LLM 写回 | `ai_revised` | |
| B10 | 重转写 | 全段 `auto_transcribe` | |
| B11 | 合并语段 | 保留左段 stage | |
| B12 | 拆分语段 | 左继承 parent；右 `auto_transcribe` | |
| B13 | 新建空语段 | `auto_transcribe` | |
| B14 | 旧库迁移 | backfill `auto_transcribe` | |
| B15 | busy / 已定稿 | 定稿入口 disabled | |
| B16 | 编辑历史恢复 | 随 snapshot 恢复 stage 字段 | |

## 3. 落位

| 层 | 模块 |
|----|------|
| DB | `db.rs` `migrate_segments_text_stage` |
| Rust | `types.rs`, `utils.rs`, `segment_cmd.rs` |
| TS 真源 | `segmentTextStage.ts`, `segmentStagePersist.ts`, `segmentFinalize.ts` |
| 写路径 | `useProjectSaveController`, Stage B / 标点写回, `useSegmentMutationController` |
| UI | `SegmentRowStageBadge`, `SegmentTextListRow`, `segmentContextMenuModel`, `EditorView` |

## 4. 验证

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

定向：`segmentTextStage.test.ts`, `segmentFinalize.test.ts`, `segment_cmd` 迁移测试。
