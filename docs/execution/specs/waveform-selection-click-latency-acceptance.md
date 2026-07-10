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
- [x] selection profile：`bandPaint` parse；预览路径可 flush；**`listCommit` 由列表 layout effect 标记**（list/listAdvance/waveform/listKeyboard）；有 list root 且 SC1 变更时跳过抢跑 `scheduleFlush`
- [x] 既有 LKB / selection chrome perf 不回归
- [x] `npm run typecheck` / `npm run test` / architecture guard 绿

---

## 3. 手测

```js
__rushiSelectionProfile.enable()
// 62 段：点波形 5 次、点列表 5 次、空格起播
__rushiSelectionProfile.print()
```

手测证据（2026-07-10，62 段 · SEL-1b 后、listCommit 接线前）：

- waveform `#14–22`：`total` 仍 **205–555ms**，`syncPathTotal` 多为 0
- list `#23–26`：`listScroll` ~27–33ms，`total` 仍 **303–604ms**
- `bandPaint` 仍 ≈0（H4 保持）

编码后（2026-07-10 · SEL-1a listCommit 真值）：

- profile 行应出现 `listCommit=…ms`（含 `0.0ms`）；用该值解释 `total`，再决定是否做 SEL-1c 全量
- **量化退出**：若 `listCommit≤80ms` 且 `total≤150ms` → SEL-1c 只做 keyboard reveal 最小修复；否则再拆 coordinator / virtual window

- [ ] H1 高亮即时（肉眼；profile total 未达 ≤150ms）
- [ ] H2 profile 出现 `listCommit`（编码已接线；待手测确认行内可见）
- [ ] H3 空格起播与视觉 playhead 对齐
- [x] H4 `bandPaint` 仍接近 0

---

## 4. 签收

- [x] SEL-1a/1b 完成（编码；listCommit 真值已补）
- [ ] SEL-1c：等 H2 手测数字后再决定最小修复或全量（见路线图量化退出点）
- [ ] 用户手测 H1–H4
