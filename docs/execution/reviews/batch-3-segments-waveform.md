# Batch 3 — 语段编辑 / Undo / 波形

## 链路

[chains/segment-edit-undo.md](./chains/segment-edit-undo.md)

## 相对 2026-05-12 报告

| 原问题 | 状态 |
|--------|------|
| DOM 在 setState updater 内 | **已修**（`flushSegmentTextDrafts` + 草稿 store，不再读 DOM） |
| pushUndo 在 updater 内 | **已修**（`updateSegmentText` 在外部 push） |
| save 后 undo 清空再 load 失败 | 需再确认 save 路径；当前 save **不**清空 undo |
| 双重 RAF 竞态 | **已缓解**（`disposed` 标志贯穿 `useProjectWaveform`） |
| region 用数组 index 作 id | **已修**（`uid` + `segmentRegionId` + Map diff） |
| region 事件闭包旧 index | **已修**（回调持 `uid`，运行时 `findIndex`） |
| `file_save_segments` 交换 idx 撞唯一约束 | **已修**（保存前临时负 idx；测 `segment_cmd_tests`） |
| 旧库多语段 uid 迁移失败 | **已修**（先回填 UUID 再建 `idx_segments_file_uid`） |
| 语段列表 DOM root 绑错容器 | **已修**（`segmentListRef`；flush 不再依赖 DOM root） |
| WASM 波形包无调用 | **已修**（desktop 依赖与 `packages/wasm-waveform` 已移除） |

## 待办

- R3-003 `SegmentTextListRow` 编排/子组件 hooks（非阻断）
- R3-004 token 颜色
- `useProjectWaveform` 职责混合（非阻断；Comfort 缩放/滚动已拆子 hook）
