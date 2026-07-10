# Acceptance：语段点选延迟（SEL-1）

> **调研**：[`waveform-selection-click-latency-research.md`](./waveform-selection-click-latency-research.md)
> **plan**：[`waveform-selection-click-latency-plan.md`](./waveform-selection-click-latency-plan.md)
> **状态**：编码完成 · 待手测签收（SEL-1c 记入后续）

---

## 1. 行为矩阵

| 场景 | 修复前（脏区后） | 期望 |
|------|------------------|------|
| 62 段 waveform 点选 | total 300–550ms，syncPath=0 | 高亮 <50ms；total ≤150ms **或** listCommit≤80ms 且可解释 |
| 62 段 list 点选 | total 300–600ms | 同上 |
| 23 段 waveform | ~110ms | ≤80ms |
| 空格起播 | 单时钟正确 | **保持**：不因 transition 跳段头 |
| bandPaint | 0–1ms | **保持** |

---

## 2. 自动化

- [x] `useSelectedIdxCommitter`：waveform/list 经 `startTransition`
- [x] selection profile：`bandPaint` parse；预览路径可 flush
- [x] 既有 LKB / selection chrome perf 不回归
- [x] `npm run typecheck` / `npm run test` / architecture guard 绿

---

## 3. 手测

```js
__rushiSelectionProfile.enable()
// 62 段：点波形 5 次、点列表 5 次、空格起播
__rushiSelectionProfile.print()
```

手测证据（2026-07-10，62 段）：

- waveform `#14–22`：`total` 仍 **205–555ms**，`syncPathTotal` 多为 0
- list `#23–26`：`listScroll` ~27–33ms，`total` 仍 **303–604ms**
- `bandPaint` 仍 ≈0（H4 保持）

- [ ] H1 高亮即时（肉眼；profile total 未达 ≤150ms）
- [ ] H2 profile 出现 `listCommit`（本轮仍缺；list 有 `listScroll`）
- [ ] H3 空格起播与视觉 playhead 对齐
- [x] H4 `bandPaint` 仍接近 0

---

## 4. 签收

- [x] SEL-1a/1b 完成（编码）
- [x] SEL-1c 完成或显式记入后续（本轮不做；列表 reconcile 收窄留 LKB/后续薄片）
- [ ] 用户手测 H1–H4（H1/H2 未达目标；需 SEL-1c 或更深列表收窄）
