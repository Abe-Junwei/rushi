# Acceptance: R3s-A — Qwen3 中文长课管线硬化

> **Research**：[r3s-a-qwen3-pipeline-hardening-research.md](./r3s-a-qwen3-pipeline-hardening-research.md)  
> **Intent**：[r3s-a-qwen3-pipeline-hardening-intent.md](./r3s-a-qwen3-pipeline-hardening-intent.md) · **Plan**：[r3s-a-qwen3-pipeline-hardening-plan.md](./r3s-a-qwen3-pipeline-hardening-plan.md)

## 自动化

- [x] Qwen 默认 `max_new_tokens=512`，非法生成参数被拒绝。
- [x] VAD 默认 threshold=0.3、max speech=20s、padding=0.3s，padding 不越界且相邻段不交叠。
- [x] 未配置 punctuation 时 raw/text 一致；配置后保留 raw text 并报告 punctuation model/耗时。
- [x] `content_cer` 去 Unicode 标点，旧 `cer_chars` 行为不变。
- [x] 下载产物记录官方 URL 与 SHA256。
- [x] Rust spike tests、ASR tests、仓库机器守卫通过。

## 金标报告

| 指标 | 要求 |
|------|------|
| `content_cer` | 同时报告 Sherpa 与 FunASR baseline；最终 G1 仍按 ADR-0007 阈值 |
| `cer_chars` | 保留，用于观察标点后整体差异，不单独裁决 ASR |
| `term_hit_rate` | expected terms 全部列出命中明细 |
| `rtfx` | CPU >= 5.0 才可讨论产品默认 |
| `vad_audio_coverage_ratio` | 记录，不设拍脑袋硬阈值 |
| `token_limit_segment_ratio` | 应为 0；非 0 必须提高上限或缩短 VAD 段 |

## 产品边界

- [x] 未改 `run_transcribe_cmd`、catalog、环境页与 SQLite 写入。
- [x] ADR-0007 仍为 `proposed + Defer`，直到金标 G1/G4 有真实结果。
