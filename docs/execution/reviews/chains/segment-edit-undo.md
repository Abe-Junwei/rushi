# 链路模拟：语段编辑 → Undo → 保存

| Step | 动作 | 预期 | 结论 |
|------|------|------|------|
| 1 | `updateSegmentText` | 单条 undo 快照（debounced 策略由 `pushUndoForTextEdit`） | OK；副作用在 updater 外 |
| 2 | `updateSegmentBounds` live/commit | live 不 push；commit push | OK |
| 3 | `splitAtSelection` | flush DOM → 分割 → undo 栈 | OK |
| 4 | `undo` / `redo` | 栈深度 ≤40 | OK |
| 5 | `saveSegments` | flush → normalize idx → DB | OK；**不**清空 undo（较 2026-05-12 报告已改进） |
| 6 | `closeFile` | 清空 segments + reset undo | OK；无确认（同 R2-003） |

## DOM flush

- `flushSegmentTextDraftsFromDom`：先 query DOM，再 `flushSync` + 纯 updater — 符合架构守卫
- 测试：`flushSegmentTextDrafts.test.ts`

## 债务

- `SegmentTextListRow` 15 hooks（R3-003）
- `useProjectWaveform` 波形/播放/区域仍混合（275 行，未超 300 但 13 hooks）
