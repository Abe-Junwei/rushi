# Plan：ASR 短语段保守合并

> **Research**：[`asr-sentence-segment-coalescing-research.md`](./asr-sentence-segment-coalescing-research.md)
> **Intent**：[`asr-sentence-segment-coalescing-intent.md`](./asr-sentence-segment-coalescing-intent.md)
> **Acceptance**：[`asr-sentence-segment-coalescing-acceptance.md`](./asr-sentence-segment-coalescing-acceptance.md)

## 实施

1. 在 `segmentation.py` 定义合并阈值与 `coalesce_short_sentence_segments()` 纯函数。
2. 只在 `segments_from_sentence_info()` 完成时间归一后调用。
3. 只当已累积段过短、边界 gap <=0.8s，且合并后不超过 15s / 40 内容字时合并。
4. 合并后时间取首段 start / 末段 end；文字顺序不变；confidence 保守合并。
5. 增加单测和 D3 金标实测，更新 acceptance。

## 止损

- 全文不一致、时间非单调或 content CER 变化：回滚合并调用。
- D3 段数低于 120 或任一新合并段 >15s / >40 内容字：收紧阈值。
- 不用升级 FunASR 或产品侧 monkey patch 绕过门禁。

