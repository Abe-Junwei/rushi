# Intent：ASR 短语段保守合并

> **Research**：[`asr-sentence-segment-coalescing-research.md`](./asr-sentence-segment-coalescing-research.md)
> **Plan**：[`asr-sentence-segment-coalescing-plan.md`](./asr-sentence-segment-coalescing-plan.md)
> **Acceptance**：[`asr-sentence-segment-coalescing-acceptance.md`](./asr-sentence-segment-coalescing-acceptance.md)

## 目标

减少 Paraformer `sentence_info` 产生的过短语段，让长音频更易浏览和编辑，同时保留明显停顿、时间顺序和完整文字。

## 范围

- 仅处理 `sentence_info` 解析结果。
- 只合并相邻、短且 gap 较小的 speech 段。
- 不改 FunASR 版本、模型权重、分窗、API schema 或 UI。
- 不处理 `vad_timestamp` 和 placeholder fallback。

## 用户价值

- 语段列表更连贯，减少频繁合并操作。
- 不跨明显停顿，波形定位仍有意义。
- 输出全文、内容 CER 和热词命中不变。

