# 验收：FunASR generate 参数能力治理

> **Research brief**：[`funasr-param-capability-research.md`](./funasr-param-capability-research.md)  
> **Plan**：[`funasr-param-capability-plan.md`](./funasr-param-capability-plan.md)

## 验收项

- [x] Paraformer / SenseVoice / Qwen / generic 的 `generate()` 参数由 profile 白名单裁剪。
- [x] 被裁剪的参数写入 `warnings`，例如 `funasr_generate_param_filtered:<key>`.
- [x] `_run_generate()` 的 TypeError strip 仍存在，但只作为 profile 外兜底；fallback warning 保持可观测。
- [x] 不新增第二套分段或 provider 真源，输出仍由 `segmentation.py` 解析。
- [x] 定向 ASR pytest、desktop typecheck、architecture guard 通过。

## 手测建议

- 使用 Paraformer 长音频转写，确认仍输出 `sentence_info` 或既有 segmentation warning。
- 使用 SenseVoice 短音频转写，确认 ITN 参数未因白名单误裁剪。
- 若后续 Nano spike 启用，确认热词参数使用对应 profile 命名，不再依赖 TypeError strip 才降级。
