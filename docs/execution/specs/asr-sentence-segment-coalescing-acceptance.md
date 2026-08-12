# Acceptance：ASR 短语段保守合并

> **Research**：[`asr-sentence-segment-coalescing-research.md`](./asr-sentence-segment-coalescing-research.md)
> **Intent**：[`asr-sentence-segment-coalescing-intent.md`](./asr-sentence-segment-coalescing-intent.md)
> **Plan**：[`asr-sentence-segment-coalescing-plan.md`](./asr-sentence-segment-coalescing-plan.md)
> **状态**：已完成（2026-08-11）

## 自动化

- [x] 相邻短段且 gap <=0.8s 时合并。
- [x] 不跨越 >0.8s 停顿。
- [x] 不产生 >15s 或 >40 内容字的新合并段。
- [x] 合并前后全文归一化内容完全一致；英文词边界保留空格。
- [x] 时间保持单调，`segmentation_mode` 仍为 `sentence_info`。
- [x] `npm run asr:test` 通过。

## D3 门禁

| 指标 | 基线 | 目标 | 实测 |
|------|------|------|------|
| segment count | 186 | 120–150 | **139** |
| 中位段长 | 1.897s | >=3.0s | **3.645s** |
| <2s 语段 | 95 | <=50 | **41** |
| content CER | 0.143343 | 不变 | **0.143343** |
| CER（含标点） | 0.211471 | 不变 | **0.211471** |
| term hit | 0.75 | 不降 | **0.75** |

D3 真实侧车输出的 wall 为 `25.401s`、RTFx `47.05`、warnings `[]`。证据：`docs/execution/spike-output/funasr-sidecar-upgrade-2026-08/coalesced-1.3.16-d3-off.json`（gitignored）。
