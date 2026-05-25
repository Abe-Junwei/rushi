# 链路模拟：语段编辑 → Undo → 保存

| Step | 动作 | 预期 | 结论 |
|------|------|------|------|
| 1 | `updateSegmentText` | 单条 undo 快照（debounced 策略由 `pushUndoForTextEdit`） | OK；副作用在 updater 外 |
| 2 | `updateSegmentBounds` live/commit | live 不 push；commit push | OK |
| 3 | `splitAtSelection` | flush 草稿 store → 分割 → undo 栈 | OK |
| 4 | `undo` / `redo` | 栈深度 ≤40 | OK |
| 5 | `saveSegments` | flush 草稿 → 按 `uid` upsert + 临时 idx 槽 → DB | OK；**不**清空 undo（较 2026-05-12 报告已改进） |
| 6 | `closeFile` | 清空 segments + reset undo | OK；无确认（同 R2-003） |

## 语段正文草稿 flush

- `SegmentRowTextField`：`useSegmentDraft`（键 = 语段 `uid`，无则 `idx:N`）
- `flushSegmentTextDrafts`：从 `segmentDraftStore` 收集脏草稿 → `flushSync` + 纯 updater — 符合架构守卫
- 打开/关闭文件：`segmentDraftStore.resetAll()`
- 测试：`segmentDraftStore.test.ts`（原 DOM 用例已移除）

## 波形 region（2026-05-25 同步）

- 稳定 `uid` + `useWaveformRegions` 按 uid diff；region 事件回调按 uid 动态 `findIndex`，避免插删后闭包旧 index
- 渲染：WaveSurfer.js（`@rushi/wasm-waveform` 已移除）

## 债务

- `SegmentTextListRow` 编排层仍偏厚（R3-003）；草稿已下沉 store，行内 `useSegmentDraft` 为 1 hook
- `useProjectWaveform` 波形/播放/区域仍混合（275 行量级，子 hook 已拆）
