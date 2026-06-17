# R3g-C — Fun-ASR-Nano-2512 Spike 结果

> **验收**：[r3g-c-funasr-nano-acceptance.md](./r3g-c-funasr-nano-acceptance.md)  
> **手测**：[r3g-c-funasr-nano-hand-test-checklist.md](./r3g-c-funasr-nano-hand-test-checklist.md)

## 环境

| 项 | 值 |
|----|-----|
| 日期 | 2026-06-17 |
| funasr 版本 | 1.3.9（PyPI 最新；尝试 git main editable install，版本仍标 1.3.9） |
| 设备 | cpu |
| 输出目录 | `docs/execution/spike-output/funasr-nano-2026-06-17/` |
| 权重来源 | HF 镜像 `model.pt` 1.97GB |

## 官方与同类方案调研摘要

| 来源 | 结论 |
|------|------|
| Fun-ASR-Nano README | AutoModel 示例使用 `batch_size=1`、`hotwords=[...]`、`language="中文"`；长音频示例挂 `vad_model` + `max_single_segment_time=30000`。 |
| Fun-ASR-Nano README | 当前模型卡仍把 timestamps / speaker diarization 列为 TODO；示例主要保证 `res[0]["text"]`。 |
| FunASR vLLM guide | Nano 的高吞吐路径是 vLLM batch / offline service；PyTorch AutoModel 是 baseline，不是桌面长音频主推路径。 |
| Qwen3-ASR / WhisperX / NeMo Canary | 同类音频 LLM / encoder-decoder 长音频方案普遍采用 VAD/短窗分块，并用独立或辅助 forced alignment 产出时间戳。 |

**实现约束**：本 spike 只验证现有 FunASR 侧车内的 PyTorch AutoModel；不引入 vLLM / offline service，不上架 catalog，不在产品路径 monkey patch 上游 `model.py`。

## 硬闸门实测（N1–N8）

| # | 指标 | Paraformer 基准 | Nano 实测 | 结果 |
|---|------|-----------------|-----------|------|
| N1 | 长音频语段数 | 198 | **0**（stub fallback） | ❌ |
| N2 | 相对 baseline | ≥ max(15, 90%×198) | 0 | ❌ |
| N3 | segmentation_mode | sentence_info | 3min 片段为 `vad_timestamp` | ❌ |
| N4 | term_hit_rate（制控） | 0.0 | N/A（长音频未产出） | ❌ |
| N5 | wall clock（制控） | ~187.5s | ~207s 后失败 | — |
| N6 | 磁盘增量 | — | ~1.97GB recognizer | ✅ |
| N7 | prepare / health | ✅ | warmup ok | ✅ |
| N8 | PyInstaller 打包 | ✅ | 未测 | — |

## 样本对照摘要

| 样本 | Paraformer | Nano |
|------|------------|------|
| S2 clear.wav 0.15s | 0 段 | 0 段（样本过短） |
| S3 制控 ~21min + hotwords | 198 段 / 187.5s | **0 段 / stub** — `tiktoken <|no|>` |
| Fun-ASR remote_code + 官方参数复测 | — | `batch_size_s` 改为 `batch_size=1` 后仍在全量制控触发 `<|no|>` |
| 制控前 3min（补充） | — | **13 段 / 80.3s** — `vad_timestamp` |
| 官方 example/zh.mp3 5.6s | — | 有文本，无 sentence_info |

## Blockers / 备注

- 全量 `制控.mp3` 默认 blocking 路径低于 1800s window 阈值，因此是单次 `generate()` 触发 `funasr_generate_failed: Encountered text corresponding to disallowed special token '<|no|>'`（与 hotword 无关）。
- 同步 Fun-ASR GitHub `model.py` / `ctc.py` / `tools/` 并改为官方 `batch_size=1`、`hotwords=[...]` 后，全量制控仍触发 `<|no|>`。
- 3min 片段可转写，但落 `vad_timestamp`；官方 README 当前不保证 `sentence_info`，timestamps / diarization 仍列 TODO。
- 不采用 monkey patch 上游 `model.py` 的方式产品化；若需修复 CTC `tiktoken.encode()`，应作为上游 issue 或单独 spike 记录。

## 结论

| 结果 | 理由 |
|------|------|
| **Defer** | N1/N2/N3 未过；需 FunASR 上游修复 tiktoken 或升级栈后再测全量长音频 |
