# Intent: R3s-A — Qwen3 中文长课管线硬化

> **Research**：[r3s-a-qwen3-pipeline-hardening-research.md](./r3s-a-qwen3-pipeline-hardening-research.md)

## 目标

在非产品 spike 中形成可复现的 `Silero VAD -> Qwen3-ASR-0.6B INT8 + hotwords -> CT-Transformer 标点` 管线，并能对 D3 金标输出可信质量报告。

## 用户可见结果

- 长音频不再使用整轨 Qwen 推理。
- 专名可通过 hotwords 传入。
- JSON 同时保留 raw text 与标点后 text。
- 评测明确区分内容识别错误和标点差异。

## 边界

- 仅 spike/eval，不进入产品转写按钮。
- 不改本地 ASR catalog 和环境页。
- 不承诺本轮跑出最终 Go；缺少本机模型时允许完成可复现入口并报告未跑项。
