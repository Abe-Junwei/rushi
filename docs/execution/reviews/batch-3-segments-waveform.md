# Batch 3 — 语段编辑 / Undo / 波形

## 链路

[chains/segment-edit-undo.md](./chains/segment-edit-undo.md)

## 相对 2026-05-12 报告

| 原问题 | 状态 |
|--------|------|
| DOM 在 setState updater 内 | **已修**（`flushSegmentTextDrafts.ts`） |
| pushUndo 在 updater 内 | **已修**（`updateSegmentText` 在外部 push） |
| save 后 undo 清空再 load 失败 | 需再确认 save 路径；当前 save **不**清空 undo |
| 双重 RAF 竞态 | **已缓解**（`disposed` 标志贯穿 `useProjectWaveform`） |

## 待办

- R3-003 `SegmentTextListRow` hooks
- R3-004 token 颜色
- `useProjectWaveform` 职责混合（非阻断）
