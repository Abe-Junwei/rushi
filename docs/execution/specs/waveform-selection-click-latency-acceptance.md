# Acceptance：语段点选延迟（SEL-1）

> **调研**：[`waveform-selection-click-latency-research.md`](./waveform-selection-click-latency-research.md)
> **plan**：[`waveform-selection-click-latency-plan.md`](./waveform-selection-click-latency-plan.md)
> **状态**：SEL-1a/1b/1c **签收**（2026-07-10 13:47–13:48 手测过闸）

---

## 1. 行为矩阵

| 场景 | 修复前（脏区后） | 期望 | SEL-1c 后 |
|------|------------------|------|-----------|
| 62 段 waveform 点选 | total 300–550ms，syncPath=0 | 高亮 <50ms；total ≤150ms **或** listCommit≤80ms | **PASS** total 0–35ms · listCommit ≤35ms |
| 62 段 list 点选 | total 300–600ms | 同上 | 保持 ~40ms 级（前序已过） |
| 23 段 waveform | ~110ms | ≤80ms | 未复测；62 段已远低于门禁 |
| 空格起播 | 单时钟正确 | **保持**：不因 transition 跳段头 | 未单独记 H3 |
| bandPaint | 0–1ms | **保持** | **PASS** 0–1ms |

---

## 2. 自动化

- [x] `useSelectedIdxCommitter`：waveform/list 经 `startTransition`；**transition 内 `selectionProfileMarkListCommit`**
- [x] selection profile：`bandPaint` parse；预览路径可 flush；**预览早退 `markFirstPaint`**；layout effect 为 listCommit backup
- [x] U12：`EditorSegmentListViewport` 不再订阅 `useSelectionChromePrimaryIdx`；虚拟槽 overflow 用 CSS `:has(.seg-row-selected)`
- [x] 既有 LKB / selection chrome perf 不回归
- [x] `npm run typecheck` / `npm run test` / architecture guard 绿

---

## 3. 手测

```js
__rushiSelectionProfile.enable()
// 62 段：停播；点波形 5 次（间隔 ≥2s）、点列表 5 次、空格起播
__rushiSelectionProfile.print()
```

手测证据（2026-07-10，62 段 · SEL-1b 后、listCommit 接线前）：

- waveform `#14–22`：`total` 仍 **205–555ms**，`syncPathTotal` 多为 0
- list `#23–26`：`listScroll` ~27–33ms，`total` 仍 **303–604ms**
- `bandPaint` 仍 ≈0（H4 保持）

编码后（2026-07-10 · SEL-1a listCommit 真值 · 干净 waveform 复测 13:35）：

| # | firstPaint | listCommit | total | syncPath |
|---|------------|------------|-------|----------|
| 1 | 610 | 822 | 822 | 0 |
| 2 | 404 | 614 | 614 | 0 |
| 3 | 240 | 478 | 478 | 0 |
| 4 | 1069 | 1284 | 1284 | 0 |
| 5 | 1210 | 1428 | 1428 | 0 |
| 6 | 452 | 674 | 674 | 0 |

结论：量化退出「只做 keyboard」**不成立** → 进入 SEL-1c（U12 + profile 归属）。

### SEL-1c 手测（2026-07-10 13:47–13:48，62 段 · 停播）

预览路径（`listCommit`/`total` ≈0，`firstPaint` 为 0 时不打印）：

| # | listCommit | total |
|---|------------|-------|
| 1 | 1 | 1 |
| 2 | 0 | 0 |
| 3 | 0 | 0 |
| 11 | 0 | 0 |

全路径（含 flush/listScroll）：

| # | firstPaint | listCommit | total | syncPath |
|---|------------|------------|-------|----------|
| 12 | — | 30 | 30 | 31 |
| 13 | — | 33 | 33 | 34 |
| 14 | — | 35 | 35 | 36 |
| 15 | 1 | 32 | 32 | 33 |
| 16 | — | 29 | 29 | 29 |

闸门：`listCommit≤80` **且** `total≤150` → **PASS**（相对 13:35 的 478–1428ms 下降约 15–40×）。

- [x] H1 高亮即时（profile total ≤35ms）
- [x] H2 profile 出现 `listCommit`
- [ ] H3 空格起播与视觉 playhead 对齐（本轮未单独采）
- [x] H4 `bandPaint` 仍接近 0

---

## 4. 签收

- [x] SEL-1a/1b 完成（编码；listCommit 真值已补）
- [x] SEL-1c 编码：profile 归属（committer `listCommit` + 预览 `firstPaint`）+ U12 Viewport 去 chrome 订阅；U11 确认 virtualWindow 已不依赖 `selectedDisplayIndex`（仅 ref）
- [x] 用户手测 H1/H2/H4（SEL-1c 后复验 PASS）
